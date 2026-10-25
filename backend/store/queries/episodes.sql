-- name: ListEpisodes :many
SELECT * FROM episodes WHERE show_id = ? ORDER BY season_number, episode_number;

-- name: UpsertEpisode :exec
-- A conflict refreshes the TMDB metadata and keeps the watched flag.
INSERT INTO episodes (show_id, season_number, episode_number, title, air_date, runtime, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT (show_id, season_number, episode_number) DO UPDATE SET
	title = excluded.title,
	air_date = excluded.air_date,
	runtime = excluded.runtime,
	updated_at = excluded.updated_at;

-- name: CountEpisodes :one
SELECT count(*) FROM episodes WHERE show_id = ?;

-- name: CountSeasons :one
SELECT CAST(coalesce(max(season_number), 0) AS INTEGER) FROM episodes WHERE show_id = ?;

-- name: SetEpisodeWatched :execrows
UPDATE episodes SET watched = sqlc.arg(watched), updated_at = sqlc.arg(now) WHERE id = sqlc.arg(id);

-- name: SetSeasonWatched :execrows
UPDATE episodes SET watched = sqlc.arg(watched), updated_at = sqlc.arg(now)
WHERE show_id = sqlc.arg(show_id) AND season_number = sqlc.arg(season_number);

-- name: SetAllEpisodesWatched :exec
UPDATE episodes SET watched = 1, updated_at = sqlc.arg(now) WHERE show_id = sqlc.arg(show_id);

-- name: EpisodeCounts :many
SELECT
	show_id,
	count(*) AS total,
	CAST(coalesce(sum(watched), 0) AS INTEGER) AS watched
FROM episodes
WHERE show_id IN (sqlc.slice(show_ids))
GROUP BY show_id;
