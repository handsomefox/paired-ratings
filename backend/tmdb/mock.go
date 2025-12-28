package tmdb

import "context"

// Mock is a configurable TMDB client for tests.
type Mock struct {
	FetchDetailsFunc   func(ctx context.Context, id int64, mediaType string) (*Detail, error)
	FetchGenresFunc    func(ctx context.Context, mediaType string) ([]Genre, error)
	FetchCountriesFunc func(ctx context.Context) ([]Country, error)
	FetchLanguagesFunc func(ctx context.Context) ([]Language, error)
	SearchPageFunc     func(ctx context.Context, query string, mediaType string, page int) (SearchPage, error)
	DiscoverPageFunc   func(ctx context.Context, mediaType string, filters DiscoverFilters, page int) (SearchPage, error)
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

func (m *Mock) SearchPage(ctx context.Context, query string, mediaType string, page int) (SearchPage, error) {
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
