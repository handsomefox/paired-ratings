// Package store provides SQLite persistence for shows and ratings.
package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"

	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/sqlitedialect"

	_ "modernc.org/sqlite"
)

type Store struct {
	sqldb *sql.DB
	db    *bun.DB
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

	if err := initSchema(ctx, sqldb); err != nil {
		if cerr := sqldb.Close(); cerr != nil {
			return nil, fmt.Errorf("init schema: %w; close failed: %w", err, cerr)
		}
		return nil, err
	}

	bdb := bun.NewDB(sqldb, sqlitedialect.New())
	slog.Info("Database ready", slog.String("path", dbPath))
	return &Store{sqldb: sqldb, db: bdb}, nil
}

func (s *Store) Close() error {
	if s == nil || s.sqldb == nil {
		return nil
	}
	return s.sqldb.Close()
}
