package store

import "errors"

// ErrNotFound reports that the show or episode does not exist.
var ErrNotFound = errors.New("not found")

type MediaType string

const (
	MediaMovie MediaType = "movie"
	MediaTV    MediaType = "tv"
)

func (m MediaType) Valid() bool {
	return m == MediaMovie || m == MediaTV
}

type Status string

const (
	StatusPlanned  Status = "planned"
	StatusWatching Status = "watching"
	StatusWatched  Status = "watched"
)

func (s Status) Valid() bool {
	return s == StatusPlanned || s == StatusWatching || s == StatusWatched
}

// Sort orders the library. The zero value means SortCreated: newest first.
type Sort string

const (
	SortCreated  Sort = "created"
	SortAverage  Sort = "avg"
	SortBf       Sort = "bf"
	SortGf       Sort = "gf"
	SortYear     Sort = "year"
	SortTitle    Sort = "title"
	SortPriority Sort = "priority"
	SortUpdated  Sort = "updated"
)

func (s Sort) Valid() bool {
	switch s {
	case "", SortCreated, SortAverage, SortBf, SortGf, SortYear, SortTitle, SortPriority, SortUpdated:
		return true
	}
	return false
}

// Metadata is what TMDB supplies for a show.
type Metadata struct {
	TMDBID         int64
	MediaType      MediaType
	Title          string
	Year           *int64
	Overview       *string
	PosterPath     *string
	IMDbID         *string
	TMDBRating     *float64
	TMDBVotes      *int64
	CollectionID   *int64
	CollectionName *string
	Genres         []string
	Countries      []string
}

func (m *Metadata) TMDBRef() TMDBRef {
	return TMDBRef{ID: m.TMDBID, MediaType: m.MediaType}
}

type Show struct {
	Metadata

	ID            int64
	Status        Status
	WatchPriority *int64
	BfRating      *int64
	GfRating      *int64
	BfComment     *string
	GfComment     *string
	CreatedAt     string
	UpdatedAt     string
}

// ListFilters selects and orders library shows. Empty fields match everything,
// and a zero PageSize returns every match.
type ListFilters struct {
	Status   Status
	YearFrom *int64
	YearTo   *int64
	Genre    string
	Country  string
	Unrated  bool
	Sort     Sort
	Page     int
	PageSize int
}

// Change replaces a stored value when Set is true. A nil Value clears it.
type Change[T any] struct {
	Set   bool
	Value *T
}

type RatingsUpdate struct {
	BfRating  Change[int64]
	GfRating  Change[int64]
	BfComment Change[string]
	GfComment Change[string]
}

type TMDBRef struct {
	ID        int64
	MediaType MediaType
}

// StaleShow is a show whose TMDB metadata is due for a refresh.
type StaleShow struct {
	Ref         TMDBRef
	ShowID      int64
	HasEpisodes bool
}

type Episode struct {
	ID            int64
	SeasonNumber  int64
	EpisodeNumber int64
	Title         *string
	AirDate       *string
	Runtime       *int64
	Watched       bool
}

// EpisodeMetadata is what TMDB supplies for an episode.
type EpisodeMetadata struct {
	SeasonNumber  int64
	EpisodeNumber int64
	Title         *string
	AirDate       *string
	Runtime       *int64
}

type EpisodeCounts struct {
	Total   int64
	Watched int64
}
