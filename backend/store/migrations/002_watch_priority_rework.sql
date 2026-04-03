-- +goose Up
-- Add single shared watch_priority, migrate data from the old dual bf/gf columns.
-- Old columns are kept (SQLite cannot drop columns) but are ignored going forward.
ALTER TABLE shows ADD COLUMN watch_priority INTEGER;

-- Seed watch_priority from the average of existing bf/gf priorities for planned shows,
-- using row number to give a stable order when priorities are equal.
UPDATE shows
SET watch_priority = (
  SELECT COUNT(*) + 1
  FROM shows s2
  WHERE s2.status = 'planned'
    AND (
      (COALESCE(s2.bf_watch_priority, 9999) + COALESCE(s2.gf_watch_priority, 9999)) <
      (COALESCE(shows.bf_watch_priority, 9999) + COALESCE(shows.gf_watch_priority, 9999))
      OR (
        (COALESCE(s2.bf_watch_priority, 9999) + COALESCE(s2.gf_watch_priority, 9999)) =
        (COALESCE(shows.bf_watch_priority, 9999) + COALESCE(shows.gf_watch_priority, 9999))
        AND s2.id < shows.id
      )
    )
)
WHERE status = 'planned';

DROP INDEX IF EXISTS idx_shows_watch_priority;
CREATE INDEX IF NOT EXISTS idx_shows_watch_priority ON shows(status, watch_priority);

-- +goose Down
DROP INDEX IF EXISTS idx_shows_watch_priority;
CREATE INDEX IF NOT EXISTS idx_shows_watch_priority ON shows(status, bf_watch_priority, gf_watch_priority);
