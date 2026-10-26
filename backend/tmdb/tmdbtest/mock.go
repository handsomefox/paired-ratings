// Package tmdbtest provides a configurable TMDB client for tests.
package tmdbtest

import (
	"context"

	"github.com/handsomefox/paired-ratings/backend/tmdb"
)

// Mock answers each call with the matching function, or with an empty result
// when the function is nil. RefreshDetails and RefreshSeason fall back to the
// Fetch functions, so a test sets the Refresh ones only to tell the two apart.
type Mock struct {
	FetchDetailsFunc         func(ctx context.Context, id int64, mediaType string) (*tmdb.Detail, error)
	RefreshDetailsFunc       func(ctx context.Context, id int64, mediaType string) (*tmdb.Detail, error)
	FetchGenresFunc          func(ctx context.Context, mediaType string) ([]tmdb.Genre, error)
	FetchCountriesFunc       func(ctx context.Context) ([]tmdb.Country, error)
	FetchLanguagesFunc       func(ctx context.Context) ([]tmdb.Language, error)
	SearchPageFunc           func(ctx context.Context, query, mediaType string, page int) (tmdb.SearchPage, error)
	DiscoverPageFunc         func(ctx context.Context, mediaType string, filters *tmdb.DiscoverFilters, page int) (tmdb.SearchPage, error)
	FetchCollectionFunc      func(ctx context.Context, collectionID int64) ([]tmdb.SearchResult, error)
	FetchRecommendationsFunc func(ctx context.Context, id int64, mediaType string) ([]tmdb.SearchResult, error)
	FetchSeasonFunc          func(ctx context.Context, showID int64, seasonNumber int) (tmdb.Season, error)
	RefreshSeasonFunc        func(ctx context.Context, showID int64, seasonNumber int) (tmdb.Season, error)
}

var _ tmdb.Interface = (*Mock)(nil)

func (m *Mock) FetchDetails(ctx context.Context, id int64, mediaType string) (*tmdb.Detail, error) {
	if m.FetchDetailsFunc == nil {
		return &tmdb.Detail{TMDBID: id, MediaType: mediaType}, nil
	}
	return m.FetchDetailsFunc(ctx, id, mediaType)
}

func (m *Mock) RefreshDetails(ctx context.Context, id int64, mediaType string) (*tmdb.Detail, error) {
	if m.RefreshDetailsFunc == nil {
		return m.FetchDetails(ctx, id, mediaType)
	}
	return m.RefreshDetailsFunc(ctx, id, mediaType)
}

func (m *Mock) FetchGenres(ctx context.Context, mediaType string) ([]tmdb.Genre, error) {
	if m.FetchGenresFunc == nil {
		return nil, nil
	}
	return m.FetchGenresFunc(ctx, mediaType)
}

func (m *Mock) FetchCountries(ctx context.Context) ([]tmdb.Country, error) {
	if m.FetchCountriesFunc == nil {
		return nil, nil
	}
	return m.FetchCountriesFunc(ctx)
}

func (m *Mock) FetchLanguages(ctx context.Context) ([]tmdb.Language, error) {
	if m.FetchLanguagesFunc == nil {
		return nil, nil
	}
	return m.FetchLanguagesFunc(ctx)
}

func (m *Mock) SearchPage(ctx context.Context, query, mediaType string, page int) (tmdb.SearchPage, error) {
	if m.SearchPageFunc == nil {
		return tmdb.SearchPage{}, nil
	}
	return m.SearchPageFunc(ctx, query, mediaType, page)
}

func (m *Mock) DiscoverPage(ctx context.Context, mediaType string, filters *tmdb.DiscoverFilters, page int) (tmdb.SearchPage, error) {
	if m.DiscoverPageFunc == nil {
		return tmdb.SearchPage{}, nil
	}
	return m.DiscoverPageFunc(ctx, mediaType, filters, page)
}

func (m *Mock) FetchCollection(ctx context.Context, collectionID int64) ([]tmdb.SearchResult, error) {
	if m.FetchCollectionFunc == nil {
		return nil, nil
	}
	return m.FetchCollectionFunc(ctx, collectionID)
}

func (m *Mock) FetchRecommendations(ctx context.Context, id int64, mediaType string) ([]tmdb.SearchResult, error) {
	if m.FetchRecommendationsFunc == nil {
		return nil, nil
	}
	return m.FetchRecommendationsFunc(ctx, id, mediaType)
}

func (m *Mock) FetchSeason(ctx context.Context, showID int64, seasonNumber int) (tmdb.Season, error) {
	if m.FetchSeasonFunc == nil {
		return tmdb.Season{}, nil
	}
	return m.FetchSeasonFunc(ctx, showID, seasonNumber)
}

func (m *Mock) RefreshSeason(ctx context.Context, showID int64, seasonNumber int) (tmdb.Season, error) {
	if m.RefreshSeasonFunc == nil {
		return m.FetchSeason(ctx, showID, seasonNumber)
	}
	return m.RefreshSeasonFunc(ctx, showID, seasonNumber)
}
