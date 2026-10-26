// Package store provides SQLite persistence for shows and ratings.
package store

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"

	"github.com/pressly/goose/v3"

	"github.com/handsomefox/paired-ratings/backend/gen/db"
	"github.com/handsomefox/paired-ratings/backend/logger"

	// Registers the "sqlite" database/sql driver.
	_ "modernc.org/sqlite"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

// connectionPragmas run on every new connection. Setting them in the DSN
// matters: a PRAGMA executed once reaches only the connection that ran it.
const connectionPragmas = "?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)"

type Store struct {
	sqldb *sql.DB
	q     *db.Queries
}

func Open(ctx context.Context, dbPath string) (*Store, error) {
	if dbPath == "" {
		return nil, errors.New("DB_PATH is required")
	}

	slog.Info("Opening database", slog.String("path", dbPath))

	if err := os.MkdirAll(filepath.Dir(dbPath), 0o750); err != nil {
		return nil, err
	}

	sqldb, err := sql.Open("sqlite", dbPath+connectionPragmas)
	if err != nil {
		return nil, err
	}

	// One connection serializes every write, which is what SQLite allows anyway,
	// and keeps transactions from waiting on each other.
	sqldb.SetMaxOpenConns(1)

	if err := prepare(ctx, sqldb); err != nil {
		if cerr := sqldb.Close(); cerr != nil {
			return nil, errors.Join(err, fmt.Errorf("close db: %w", cerr))
		}
		return nil, err
	}

	slog.Info("Database ready", slog.String("path", dbPath))
	return &Store{sqldb: sqldb, q: db.New(sqldb)}, nil
}

func prepare(ctx context.Context, sqldb *sql.DB) error {
	if err := sqldb.PingContext(ctx); err != nil {
		return fmt.Errorf("ping db: %w", err)
	}

	legacy, err := isLegacySchema(ctx, sqldb)
	if err != nil {
		return err
	}
	if legacy {
		return errors.New("the database uses the schema from before the 001_schema baseline; " +
			"check out commit 8799861 and convert it with `go run ./backend/cmd/convert-legacy`")
	}

	migrations, err := fs.Sub(migrationFS, "migrations")
	if err != nil {
		return err
	}
	provider, err := goose.NewProvider(goose.DialectSQLite3, sqldb, migrations)
	if err != nil {
		return fmt.Errorf("goose: %w", err)
	}
	if _, err := provider.Up(ctx); err != nil {
		return fmt.Errorf("goose up: %w", err)
	}
	return nil
}

// isLegacySchema reports a database whose shows table still stores genres as
// one comma-joined column. Running the new migrations on it would mix the two
// schemas, so Open refuses it.
func isLegacySchema(ctx context.Context, sqldb *sql.DB) (bool, error) {
	var n int
	err := sqldb.QueryRowContext(ctx,
		`SELECT count(*) FROM pragma_table_info('shows') WHERE name = 'genres'`,
	).Scan(&n)
	if err != nil {
		return false, fmt.Errorf("inspect schema: %w", err)
	}
	return n > 0, nil
}

// inTx runs fn in a transaction. fn must use only the Queries it receives: the
// pool has a single connection, which the transaction holds until it ends.
func (s *Store) inTx(ctx context.Context, fn func(q *db.Queries) error) error {
	tx, err := s.sqldb.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() {
		if err := tx.Rollback(); err != nil && !errors.Is(err, sql.ErrTxDone) {
			slog.Error("rollback transaction failed", logger.Error(err))
		}
	}()

	if err := fn(s.q.WithTx(tx)); err != nil {
		return err
	}
	return tx.Commit()
}

func (s *Store) Close() error {
	return s.sqldb.Close()
}

// notFound maps the "no row" results to ErrNotFound.
func notFound(err error) error {
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	return err
}

func expectAffected(n int64, err error) error {
	if err != nil {
		return err
	}
	if n == 0 {
		return ErrNotFound
	}
	return nil
}
