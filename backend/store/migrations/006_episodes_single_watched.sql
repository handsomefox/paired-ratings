-- +goose Up
ALTER TABLE episodes ADD COLUMN watched INTEGER NOT NULL DEFAULT 0;
UPDATE episodes SET watched = 1 WHERE bf_watched = 1 OR gf_watched = 1;
ALTER TABLE episodes DROP COLUMN bf_watched;
ALTER TABLE episodes DROP COLUMN gf_watched;

-- +goose Down
ALTER TABLE episodes ADD COLUMN bf_watched INTEGER NOT NULL DEFAULT 0;
ALTER TABLE episodes ADD COLUMN gf_watched INTEGER NOT NULL DEFAULT 0;
UPDATE episodes SET bf_watched = watched, gf_watched = watched;
ALTER TABLE episodes DROP COLUMN watched;
