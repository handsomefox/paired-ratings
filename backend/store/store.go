// Package store provides SQLite persistence for shows and ratings.
package store

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"

	"github.com/pressly/goose/v3"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/sqlitedialect"

	_ "modernc.org/sqlite"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

type Store struct {
	sqldb  *sql.DB
	db     *bun.DB
	dbPath string
}

func Open(dbPath string) (*Store, error) {
	if dbPath == "" {
		return nil, errors.New("DB_PATH is required")
	}

	slog.Info("Opening database", slog.String("path", dbPath))

	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return nil, err
	}

	sqldb, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}

	// SQLite behaves best with a small connection pool.
	sqldb.SetMaxOpenConns(1)
	sqldb.SetMaxIdleConns(1)
	sqldb.SetConnMaxLifetime(0)

	ctx := context.Background()
	if err := sqldb.PingContext(ctx); err != nil {
		if cerr := sqldb.Close(); cerr != nil {
			return nil, fmt.Errorf("ping db: %w; close failed: %w", err, cerr)
		}
		return nil, err
	}

	if err := applyPragmas(ctx, sqldb); err != nil {
		if cerr := sqldb.Close(); cerr != nil {
			return nil, fmt.Errorf("apply pragmas: %w; close failed: %w", err, cerr)
		}
		return nil, err
	}

	if err := runMigrations(sqldb); err != nil {
		if cerr := sqldb.Close(); cerr != nil {
			return nil, fmt.Errorf("run migrations: %w; close failed: %w", err, cerr)
		}
		return nil, err
	}

	bdb := bun.NewDB(sqldb, sqlitedialect.New())
	slog.Info("Database ready", slog.String("path", dbPath))
	return &Store{sqldb: sqldb, db: bdb, dbPath: dbPath}, nil
}

// DBPath returns the filesystem path of the database file.
func (s *Store) DBPath() string {
	return s.dbPath
}


func runMigrations(db *sql.DB) error {
	goose.SetBaseFS(migrationFS)
	goose.SetLogger(goose.NopLogger())

	if err := goose.SetDialect("sqlite3"); err != nil {
		return fmt.Errorf("goose set dialect: %w", err)
	}

	if err := goose.Up(db, "migrations"); err != nil {
		return fmt.Errorf("goose up: %w", err)
	}

	return nil
}

func (s *Store) Close() error {
	if s == nil || s.sqldb == nil {
		return nil
	}
	return s.sqldb.Close()
}
