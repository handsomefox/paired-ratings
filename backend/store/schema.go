package store

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
)

// Cache used only for schema checks on startup.
// Key format: "<table>.<column>" -> bool.
var hasColumnCache sync.Map

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

func initSchema(ctx context.Context, db *sql.DB) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	schema := `
CREATE TABLE IF NOT EXISTS shows (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	tmdb_id INTEGER NOT NULL,
	media_type TEXT NOT NULL,
	title TEXT NOT NULL,
	year INTEGER,
	genres TEXT,
	overview TEXT,
	poster_path TEXT,
	imdb_id TEXT,
	tmdb_rating REAL,
	tmdb_votes INTEGER,
	origin_country TEXT,
	status TEXT NOT NULL,
	bf_rating INTEGER,
	gf_rating INTEGER,
	bf_comment TEXT,
	gf_comment TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	UNIQUE(tmdb_id, media_type)
);
CREATE INDEX IF NOT EXISTS idx_shows_status ON shows(status);
CREATE INDEX IF NOT EXISTS idx_shows_year ON shows(year);
`
	if _, err := tx.ExecContext(ctx, schema); err != nil {
		return err
	}

	// Migrations for older DB files where the table already exists but columns were added later.
	if err := addColumnIfMissingTx(ctx, tx, "shows", "imdb_id", "ALTER TABLE shows ADD COLUMN imdb_id TEXT"); err != nil {
		return err
	}
	if err := addColumnIfMissingTx(ctx, tx, "shows", "tmdb_rating", "ALTER TABLE shows ADD COLUMN tmdb_rating REAL"); err != nil {
		return err
	}
	if err := addColumnIfMissingTx(ctx, tx, "shows", "tmdb_votes", "ALTER TABLE shows ADD COLUMN tmdb_votes INTEGER"); err != nil {
		return err
	}
	if err := addColumnIfMissingTx(ctx, tx, "shows", "origin_country", "ALTER TABLE shows ADD COLUMN origin_country TEXT"); err != nil {
		return err
	}

	return tx.Commit()
}

func addColumnIfMissingTx(ctx context.Context, tx *sql.Tx, table, column, statement string) error {
	cacheKey := table + "." + column

	has, err := hasColumnTx(ctx, tx, table, column)
	if err != nil {
		return err
	}
	if has {
		return nil
	}

	if _, err := tx.ExecContext(ctx, statement); err != nil {
		// If it failed because the column already exists (or concurrent init),
		// the column will be visible now. Treat that as success.
		hasColumnCache.Delete(cacheKey)
		has2, herr := hasColumnTx(ctx, tx, table, column)
		if herr == nil && has2 {
			hasColumnCache.Store(cacheKey, true)
			return nil
		}
		return err
	}

	hasColumnCache.Store(cacheKey, true)
	return nil
}

func hasColumnTx(ctx context.Context, tx *sql.Tx, table, column string) (bool, error) {
	cacheKey := table + "." + column
	if cached, ok := hasColumnCache.Load(cacheKey); ok {
		return cached.(bool), nil
	}

	rows, err := tx.QueryContext(ctx, fmt.Sprintf("PRAGMA table_info(%s)", table))
	if err != nil {
		return false, err
	}
	defer rows.Close()

	for rows.Next() {
		var cid int
		var name string
		var ctype string
		var notnull int
		var dflt sql.Null[string]
		var pk int
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			return false, err
		}
		if name == column {
			hasColumnCache.Store(cacheKey, true)
			return true, nil
		}
	}
	if err := rows.Err(); err != nil {
		return false, err
	}

	hasColumnCache.Store(cacheKey, false)
	return false, nil
}
