package tmdb

import "context"

// Interface is the TMDB client contract for handlers and tests.
type Interface interface {
	FetchDetails(ctx context.Context, id int64, mediaType string) (*Detail, error)
	FetchGenres(ctx context.Context, mediaType string) ([]Genre, error)
	FetchCountries(ctx context.Context) ([]Country, error)
	FetchLanguages(ctx context.Context) ([]Language, error)
	SearchPage(ctx context.Context, query, mediaType string, page int) (SearchPage, error)
	DiscoverPage(ctx context.Context, mediaType string, filters DiscoverFilters, page int) (SearchPage, error)
	FetchCollection(ctx context.Context, collectionID int64) ([]SearchResult, error)
	FetchRecommendations(ctx context.Context, id int64, mediaType string) ([]SearchResult, error)
	FetchSeason(ctx context.Context, showID int64, seasonNumber int) (Season, error)
}

var _ Interface = (*Client)(nil)
