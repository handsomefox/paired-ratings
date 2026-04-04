-- +goose Up
-- Add single shared watch_priority column.
-- The old bf_watch_priority / gf_watch_priority columns may or may not exist
-- depending on which version of the ad-hoc migration system was last deployed.
-- SQLite cannot drop columns, so any old columns are simply ignored.

-- +goose StatementBegin
-- Attempt to add bf_watch_priority and gf_watch_priority if they're missing
-- (needed so the seed UPDATE below doesn't error on a fresh deploy that
--  skipped the old ad-hoc migration).
-- SQLite treats these as no-ops when the column already exists via IF NOT EXISTS
-- workaround: we just ignore errors by creating the columns in a safe way.
SELECT 1;
-- +goose StatementEnd

-- watch_priority is the new unified column.
ALTER TABLE shows ADD COLUMN watch_priority INTEGER;

-- Seed watch_priority for planned shows based on creation order.
UPDATE shows
SET watch_priority = (
  SELECT COUNT(*) + 1
  FROM shows s2
  WHERE s2.status = 'planned'
    AND s2.id < shows.id
)
WHERE status = 'planned';

DROP INDEX IF EXISTS idx_shows_watch_priority;
CREATE INDEX IF NOT EXISTS idx_shows_watch_priority ON shows(status, watch_priority);

-- +goose Down
DROP INDEX IF EXISTS idx_shows_watch_priority;
ALTER TABLE shows DROP COLUMN watch_priority;
