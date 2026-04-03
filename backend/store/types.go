package store

import (
	"database/sql"

	"github.com/uptrace/bun"
)

type Show struct {
	bun.BaseModel `bun:"table:shows,alias:s"`

	ID            int64             `bun:"id,pk,autoincrement"`
	TMDBID        int64             `bun:"tmdb_id,notnull"`
	MediaType     string            `bun:"media_type,notnull"`
	Title         string            `bun:"title,notnull"`
	Year          sql.Null[int64]   `bun:"year,nullzero"`
	Genres        sql.Null[string]  `bun:"genres,nullzero"`
	Overview      sql.Null[string]  `bun:"overview,nullzero"`
	PosterPath    sql.Null[string]  `bun:"poster_path,nullzero"`
	IMDbID        sql.Null[string]  `bun:"imdb_id,nullzero"`
	TMDBRating    sql.Null[float64] `bun:"tmdb_rating,nullzero"`
	TMDBVotes     sql.Null[int64]   `bun:"tmdb_votes,nullzero"`
	OriginCountry sql.Null[string]  `bun:"origin_country,nullzero"`
	Status        string            `bun:"status,notnull"`

	BfRating  sql.Null[int64]  `bun:"bf_rating,nullzero"`
	GfRating  sql.Null[int64]  `bun:"gf_rating,nullzero"`
	BfComment sql.Null[string] `bun:"bf_comment,nullzero"`
	GfComment sql.Null[string] `bun:"gf_comment,nullzero"`

	WatchPriority sql.Null[int32] `bun:"watch_priority,nullzero"`

	CreatedAt string `bun:"created_at,notnull"`
	UpdatedAt string `bun:"updated_at,notnull"`
}

type ListFilters struct {
	Status   string
	YearFrom *int
	YearTo   *int
	Genre    string
	Country  string
	Unrated  bool
	Sort     string
}

type TMDBRef struct {
	ID        int64  `bun:"tmdb_id"`
	MediaType string `bun:"media_type"`
}

type TMDBRefresh struct {
	TMDBID    int64  `bun:"tmdb_id"`
	MediaType string `bun:"media_type"`
	Status    string `bun:"status"`
}
