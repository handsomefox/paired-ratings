-- +goose Up
ALTER TABLE shows ADD COLUMN collection_id INTEGER;
ALTER TABLE shows ADD COLUMN collection_name TEXT;

-- +goose Down
