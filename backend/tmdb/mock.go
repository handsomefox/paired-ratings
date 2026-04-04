package tmdb

import "context"

// Mock is a configurable TMDB client for tests.
type Mock struct {
	FetchDetailsFunc         func(ctx context.Context, id int64, mediaType string) (*Detail, error)
	FetchGenresFunc          func(ctx context.Context, mediaType string) ([]Genre, error)
	FetchCountriesFunc       func(ctx context.Context) ([]Country, error)
	FetchLanguagesFunc       func(ctx context.Context) ([]Language, error)
	SearchPageFunc           func(ctx context.Context, query string, mediaType string, page int) (SearchPage, error)
	DiscoverPageFunc         func(ctx context.Context, mediaType string, filters DiscoverFilters, page int) (SearchPage, error)
	FetchCollectionFunc      func(ctx context.Context, collectionID int64) ([]SearchResult, error)
	FetchRecommendationsFunc func(ctx context.Context, id int64, mediaType string) ([]SearchResult, error)
	FetchSeasonFunc          func(ctx context.Context, showID int64, seasonNumber int) (Season, error)
}

var _ Interface = (*Mock)(nil)

func (m *Mock) FetchDetails(ctx context.Context, id int64, mediaType string) (*Detail, error) {
	if m.FetchDetailsFunc == nil {
		return &Detail{}, nil
	}
	return m.FetchDetailsFunc(ctx, id, mediaType)
}

func (m *Mock) FetchGenres(ctx context.Context, mediaType string) ([]Genre, error) {
	if m.FetchGenresFunc == nil {
		return nil, nil
	}
	return m.FetchGenresFunc(ctx, mediaType)
}

func (m *Mock) FetchCountries(ctx context.Context) ([]Country, error) {
	if m.FetchCountriesFunc == nil {
		return nil, nil
	}
	return m.FetchCountriesFunc(ctx)
}

func (m *Mock) FetchLanguages(ctx context.Context) ([]Language, error) {
	if m.FetchLanguagesFunc == nil {
		return nil, nil
	}
	return m.FetchLanguagesFunc(ctx)
}

func (m *Mock) SearchPage(ctx context.Context, query, mediaType string, page int) (SearchPage, error) {
	if m.SearchPageFunc == nil {
		return SearchPage{}, nil
	}
	return m.SearchPageFunc(ctx, query, mediaType, page)
}

func (m *Mock) DiscoverPage(ctx context.Context, mediaType string, filters DiscoverFilters, page int) (SearchPage, error) {
	if m.DiscoverPageFunc == nil {
		return SearchPage{}, nil
	}
	return m.DiscoverPageFunc(ctx, mediaType, filters, page)
}

func (m *Mock) FetchCollection(ctx context.Context, collectionID int64) ([]SearchResult, error) {
	if m.FetchCollectionFunc == nil {
		return nil, nil
	}
	return m.FetchCollectionFunc(ctx, collectionID)
}

func (m *Mock) FetchRecommendations(ctx context.Context, id int64, mediaType string) ([]SearchResult, error) {
	if m.FetchRecommendationsFunc == nil {
		return nil, nil
	}
	return m.FetchRecommendationsFunc(ctx, id, mediaType)
}

func (m *Mock) FetchSeason(ctx context.Context, showID int64, seasonNumber int) (Season, error) {
	if m.FetchSeasonFunc == nil {
		return Season{}, nil
	}
	return m.FetchSeasonFunc(ctx, showID, seasonNumber)
}
