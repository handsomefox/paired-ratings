-- +goose Up
-- updated_at moves on any edit, including a rating change, so it cannot say
-- when TMDB metadata was last pulled. Track that separately.
-- Existing rows stay NULL, which the refresh treats as never refreshed.
ALTER TABLE shows ADD COLUMN tmdb_refreshed_at TEXT;
CREATE INDEX IF NOT EXISTS idx_shows_tmdb_refreshed_at ON shows(tmdb_refreshed_at);

-- +goose Down
DROP INDEX IF EXISTS idx_shows_tmdb_refreshed_at;
ALTER TABLE shows DROP COLUMN tmdb_refreshed_at;
