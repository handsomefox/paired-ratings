-- name: UpsertShow :one
-- A conflict refreshes the TMDB metadata only. Status, ratings, comments, the
-- watch order and updated_at belong to the people using the app.
INSERT INTO shows (
	tmdb_id, media_type, title, year, overview, poster_path, imdb_id,
	tmdb_rating, tmdb_votes, collection_id, collection_name, status,
	created_at, updated_at, tmdb_refreshed_at
) VALUES (
	sqlc.arg(tmdb_id), sqlc.arg(media_type), sqlc.arg(title), sqlc.narg(year),
	sqlc.narg(overview), sqlc.narg(poster_path), sqlc.narg(imdb_id),
	sqlc.narg(tmdb_rating), sqlc.narg(tmdb_votes), sqlc.narg(collection_id),
	sqlc.narg(collection_name), sqlc.arg(status),
	sqlc.arg(now), sqlc.arg(now), sqlc.arg(now)
)
ON CONFLICT (tmdb_id, media_type) DO UPDATE SET
	title = excluded.title,
	year = excluded.year,
	overview = excluded.overview,
	poster_path = excluded.poster_path,
	imdb_id = excluded.imdb_id,
	tmdb_rating = excluded.tmdb_rating,
	tmdb_votes = excluded.tmdb_votes,
	collection_id = excluded.collection_id,
	collection_name = excluded.collection_name,
	tmdb_refreshed_at = excluded.tmdb_refreshed_at
RETURNING id;

-- name: UpdateShowMetadata :one
-- A refresh changes only TMDB metadata and never creates a show.
UPDATE shows SET
	title = sqlc.arg(title),
	year = sqlc.narg(year),
	overview = sqlc.narg(overview),
	poster_path = sqlc.narg(poster_path),
	imdb_id = sqlc.narg(imdb_id),
	tmdb_rating = sqlc.narg(tmdb_rating),
	tmdb_votes = sqlc.narg(tmdb_votes),
	collection_id = sqlc.narg(collection_id),
	collection_name = sqlc.narg(collection_name),
	tmdb_refreshed_at = sqlc.arg(now)
WHERE tmdb_id = sqlc.arg(tmdb_id) AND media_type = sqlc.arg(media_type)
RETURNING id;

-- name: DeleteShowGenres :exec
DELETE FROM show_genres WHERE show_id = ?;

-- name: InsertShowGenre :exec
INSERT INTO show_genres (show_id, position, name) VALUES (?, ?, ?);

-- name: DeleteShowCountries :exec
DELETE FROM show_countries WHERE show_id = ?;

-- name: InsertShowCountry :exec
INSERT INTO show_countries (show_id, position, code) VALUES (?, ?, ?);

-- name: GetShow :one
SELECT * FROM shows WHERE id = ?;

-- name: ListGenresForShows :many
SELECT show_id, name FROM show_genres
WHERE show_id IN (sqlc.slice(show_ids))
ORDER BY show_id, position;

-- name: ListCountriesForShows :many
SELECT show_id, code FROM show_countries
WHERE show_id IN (sqlc.slice(show_ids))
ORDER BY show_id, position;

-- ListShows and CountShows share one WHERE clause. Change both together;
-- TestListShowsCountMatches checks that they agree.

-- name: ListShows :many
-- sqlc does not substitute parameters inside ORDER BY, so the sort key goes
-- through the params CTE.
WITH params AS (SELECT CAST(sqlc.arg(sort) AS TEXT) AS sort)
SELECT shows.* FROM shows, params
WHERE (CAST(sqlc.arg(status) AS TEXT) = '' OR shows.status = sqlc.arg(status))
	AND (CAST(sqlc.narg(year_from) AS INTEGER) IS NULL OR shows.year >= sqlc.narg(year_from))
	AND (CAST(sqlc.narg(year_to) AS INTEGER) IS NULL OR shows.year <= sqlc.narg(year_to))
	AND (CAST(sqlc.arg(genre) AS TEXT) = '' OR EXISTS (
		SELECT 1 FROM show_genres g WHERE g.show_id = shows.id AND g.name = sqlc.arg(genre)))
	AND (CAST(sqlc.arg(country) AS TEXT) = '' OR EXISTS (
		SELECT 1 FROM show_countries c WHERE c.show_id = shows.id AND c.code = sqlc.arg(country)))
	AND (CAST(sqlc.arg(unrated) AS INTEGER) = 0 OR shows.bf_rating IS NULL OR shows.gf_rating IS NULL)
	AND (params.sort != 'priority' OR shows.watch_priority IS NOT NULL)
ORDER BY
	CASE WHEN params.sort = 'avg' THEN
		(coalesce(shows.bf_rating, 0) + coalesce(shows.gf_rating, 0)) * 1.0
			/ nullif((shows.bf_rating IS NOT NULL) + (shows.gf_rating IS NOT NULL), 0)
	END DESC,
	CASE WHEN params.sort = 'bf' THEN shows.bf_rating END DESC,
	CASE WHEN params.sort = 'gf' THEN shows.gf_rating END DESC,
	CASE WHEN params.sort = 'year' THEN shows.year END DESC,
	CASE WHEN params.sort = 'title' THEN shows.title END COLLATE NOCASE ASC,
	CASE WHEN params.sort = 'priority' THEN shows.watch_priority END ASC,
	CASE WHEN params.sort = 'updated' THEN shows.updated_at END DESC,
	shows.created_at DESC,
	shows.id DESC
LIMIT sqlc.arg(row_limit) OFFSET sqlc.arg(row_offset);

-- name: CountShows :one
WITH params AS (SELECT CAST(sqlc.arg(sort) AS TEXT) AS sort)
SELECT count(*) FROM shows, params
WHERE (CAST(sqlc.arg(status) AS TEXT) = '' OR shows.status = sqlc.arg(status))
	AND (CAST(sqlc.narg(year_from) AS INTEGER) IS NULL OR shows.year >= sqlc.narg(year_from))
	AND (CAST(sqlc.narg(year_to) AS INTEGER) IS NULL OR shows.year <= sqlc.narg(year_to))
	AND (CAST(sqlc.arg(genre) AS TEXT) = '' OR EXISTS (
		SELECT 1 FROM show_genres g WHERE g.show_id = shows.id AND g.name = sqlc.arg(genre)))
	AND (CAST(sqlc.arg(country) AS TEXT) = '' OR EXISTS (
		SELECT 1 FROM show_countries c WHERE c.show_id = shows.id AND c.code = sqlc.arg(country)))
	AND (CAST(sqlc.arg(unrated) AS INTEGER) = 0 OR shows.bf_rating IS NULL OR shows.gf_rating IS NULL)
	AND (params.sort != 'priority' OR shows.watch_priority IS NOT NULL);

-- name: ListDistinctGenres :many
SELECT DISTINCT name FROM show_genres ORDER BY name COLLATE NOCASE;

-- name: ListDistinctCountries :many
SELECT DISTINCT code FROM show_countries ORDER BY code;

-- name: ShowsByTMDBIDs :many
SELECT id, tmdb_id, media_type FROM shows WHERE tmdb_id IN (sqlc.slice(tmdb_ids));

-- name: UpdateRatings :execrows
-- Each set_* flag says whether the matching value replaces the stored one, so
-- two people saving their own rating at the same time cannot undo each other.
UPDATE shows SET
	bf_rating = CASE WHEN CAST(sqlc.arg(set_bf_rating) AS INTEGER) THEN CAST(sqlc.narg(bf_rating) AS INTEGER) ELSE bf_rating END,
	gf_rating = CASE WHEN CAST(sqlc.arg(set_gf_rating) AS INTEGER) THEN CAST(sqlc.narg(gf_rating) AS INTEGER) ELSE gf_rating END,
	bf_comment = CASE WHEN CAST(sqlc.arg(set_bf_comment) AS INTEGER) THEN CAST(sqlc.narg(bf_comment) AS TEXT) ELSE bf_comment END,
	gf_comment = CASE WHEN CAST(sqlc.arg(set_gf_comment) AS INTEGER) THEN CAST(sqlc.narg(gf_comment) AS TEXT) ELSE gf_comment END,
	updated_at = sqlc.arg(now)
WHERE id = sqlc.arg(id);

-- name: ClearRatings :execrows
UPDATE shows SET
	bf_rating = NULL, gf_rating = NULL, bf_comment = NULL, gf_comment = NULL,
	updated_at = sqlc.arg(now)
WHERE id = sqlc.arg(id);

-- name: UpdateStatus :execrows
-- A watched show leaves the watch order.
UPDATE shows SET
	status = sqlc.arg(status),
	watch_priority = CASE WHEN sqlc.arg(status) = 'watched' THEN NULL ELSE watch_priority END,
	updated_at = sqlc.arg(now)
WHERE id = sqlc.arg(id);

-- name: ListWatchOrder :many
SELECT id FROM shows WHERE watch_priority IS NOT NULL ORDER BY watch_priority, id;

-- name: SetWatchPriority :execrows
UPDATE shows SET watch_priority = sqlc.arg(watch_priority) WHERE id = sqlc.arg(id);

-- name: AddToWatchOrder :execrows
-- A show already in the watch order keeps its place.
UPDATE shows SET
	watch_priority = coalesce(watch_priority, (SELECT coalesce(max(s.watch_priority), 0) + 1 FROM shows s)),
	updated_at = sqlc.arg(now)
WHERE shows.id = sqlc.arg(id);

-- name: RemoveFromWatchOrder :execrows
UPDATE shows SET watch_priority = NULL, updated_at = sqlc.arg(now) WHERE id = sqlc.arg(id);

-- name: DeleteShow :execrows
DELETE FROM shows WHERE id = ?;

-- name: ListStaleShows :many
SELECT
	id, tmdb_id, media_type,
	CAST(EXISTS (SELECT 1 FROM episodes e WHERE e.show_id = shows.id) AS INTEGER) AS has_episodes
FROM shows
WHERE tmdb_refreshed_at < ?
ORDER BY id;
