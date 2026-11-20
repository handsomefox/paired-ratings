-- +goose Up
-- Ratings go from 0.5 to 10 in steps of 0.5. SQLite cannot change a column's
-- type or CHECK in place, and rebuilding the table would drop it, which
-- deletes every genre, country and episode through the foreign keys. So each
-- rating moves to a new REAL column that takes the old name.
ALTER TABLE shows ADD COLUMN bf_rating_half REAL
	CHECK (bf_rating_half BETWEEN 0.5 AND 10 AND bf_rating_half * 2 = round(bf_rating_half * 2));
ALTER TABLE shows ADD COLUMN gf_rating_half REAL
	CHECK (gf_rating_half BETWEEN 0.5 AND 10 AND gf_rating_half * 2 = round(gf_rating_half * 2));
UPDATE shows SET bf_rating_half = bf_rating, gf_rating_half = gf_rating;
ALTER TABLE shows DROP COLUMN bf_rating;
ALTER TABLE shows DROP COLUMN gf_rating;
ALTER TABLE shows RENAME COLUMN bf_rating_half TO bf_rating;
ALTER TABLE shows RENAME COLUMN gf_rating_half TO gf_rating;

-- +goose Down
-- Whole stars only: a half rating rounds up, so 0.5 becomes 1.
ALTER TABLE shows ADD COLUMN bf_rating_whole INTEGER CHECK (bf_rating_whole BETWEEN 1 AND 10);
ALTER TABLE shows ADD COLUMN gf_rating_whole INTEGER CHECK (gf_rating_whole BETWEEN 1 AND 10);
UPDATE shows SET
	bf_rating_whole = CAST(ceil(bf_rating) AS INTEGER),
	gf_rating_whole = CAST(ceil(gf_rating) AS INTEGER);
ALTER TABLE shows DROP COLUMN bf_rating;
ALTER TABLE shows DROP COLUMN gf_rating;
ALTER TABLE shows RENAME COLUMN bf_rating_whole TO bf_rating;
ALTER TABLE shows RENAME COLUMN gf_rating_whole TO gf_rating;
