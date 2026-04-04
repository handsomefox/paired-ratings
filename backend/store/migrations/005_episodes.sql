-- +goose Up
CREATE TABLE IF NOT EXISTS episodes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  show_id INTEGER NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  season_number INTEGER NOT NULL,
  episode_number INTEGER NOT NULL,
  title TEXT,
  overview TEXT,
  air_date TEXT,
  runtime INTEGER,
  bf_watched INTEGER NOT NULL DEFAULT 0,
  gf_watched INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  UNIQUE(show_id, season_number, episode_number)
);
CREATE INDEX IF NOT EXISTS idx_episodes_show ON episodes(show_id);

-- +goose Down
DROP INDEX IF EXISTS idx_episodes_show;
DROP TABLE IF EXISTS episodes;
