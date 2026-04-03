-- +goose Up
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
	bf_watch_priority INTEGER,
	gf_watch_priority INTEGER,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	UNIQUE(tmdb_id, media_type)
);
CREATE INDEX IF NOT EXISTS idx_shows_status ON shows(status);
CREATE INDEX IF NOT EXISTS idx_shows_year ON shows(year);
CREATE INDEX IF NOT EXISTS idx_shows_watch_priority ON shows(status, bf_watch_priority, gf_watch_priority);

-- +goose Down
DROP INDEX IF EXISTS idx_shows_watch_priority;
DROP INDEX IF EXISTS idx_shows_year;
DROP INDEX IF EXISTS idx_shows_status;
DROP TABLE IF EXISTS shows;
