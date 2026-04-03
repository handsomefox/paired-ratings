package store

import (
	"context"
	"database/sql"
)

func applyPragmas(ctx context.Context, db *sql.DB) error {
	stmts := []string{
		"PRAGMA journal_mode = WAL;",
		"PRAGMA busy_timeout = 5000;",
	}

	for _, stmt := range stmts {
		if _, err := db.ExecContext(ctx, stmt); err != nil {
			return err
		}
	}
	return nil
}
