package tmdb

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// newTestClient returns a client whose requests go to routes, keyed by path.
func newTestClient(t *testing.T, routes map[string]string) *Client {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "Bearer token", r.Header.Get("Authorization"))
		body, ok := routes[r.URL.Path]
		if !ok {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, err := w.Write([]byte(body))
		assert.NoError(t, err)
	}))
	t.Cleanup(srv.Close)

	c := New(" token ")
	c.baseURL = srv.URL
	return c
}

func TestFetchDetails(t *testing.T) {
	c := newTestClient(t, map[string]string{
		"/tv/1": `{
			"id": 1, "name": "Severance", "title": "", "first_air_date": "2022-02-17",
			"origin_country": [], "production_countries": [{"iso_3166_1": "US"}],
			"external_ids": {"imdb_id": "tt11280740"}, "genres": [{"name": "Drama"}, {"name": " "}],
			"number_of_seasons": 2, "vote_average": 8.4, "vote_count": 2923
		}`,
		"/movie/2": `{
			"id": 2, "title": "Dune: Part Two", "release_date": "2024-02-27",
			"origin_country": ["US", " "], "belongs_to_collection": {"id": 726871, "name": "Dune Collection"}
		}`,
	})

	tv, err := c.FetchDetails(t.Context(), 1, "tv")
	require.NoError(t, err)
	assert.Equal(t, &Detail{
		TMDBID: 1, MediaType: "tv", Title: "Severance", Year: "2022",
		IMDbID: "tt11280740", Genres: []string{"Drama"}, OriginCountry: []string{"US"},
		NumberOfSeasons: 2, VoteAverage: 8.4, VoteCount: 2923,
	}, tv)

	movie, err := c.FetchDetails(t.Context(), 2, "movie")
	require.NoError(t, err)
	assert.Equal(t, "Dune: Part Two", movie.Title)
	assert.Equal(t, "2024", movie.Year)
	assert.Equal(t, []string{"US"}, movie.OriginCountry)
	assert.Equal(t, int64(726871), movie.CollectionID)

	_, err = c.FetchDetails(t.Context(), 3, "movie")
	require.ErrorContains(t, err, "tmdb /movie/3: 404 Not Found")
	_, err = c.FetchDetails(t.Context(), 1, "book")
	require.ErrorIs(t, err, errMediaType)
}

func TestSearchPage(t *testing.T) {
	c := newTestClient(t, map[string]string{
		"/search/tv": `{
			"page": 1, "total_pages": 900, "total_results": 18000,
			"results": [{"id": 5, "name": "Dark", "first_air_date": "2017-12-01", "popularity": 12.5}]
		}`,
	})

	page, err := c.SearchPage(t.Context(), "dark", "tv", 1)
	require.NoError(t, err)
	assert.Equal(t, MaxPage, page.TotalPages)
	assert.Equal(t, []SearchResult{{ID: 5, MediaType: "tv", Title: "Dark", Year: "2017", Popularity: 12.5}}, page.Results)

	empty, err := c.SearchPage(t.Context(), "  ", "tv", 1)
	require.NoError(t, err)
	assert.Empty(t, empty.Results)
}

func TestFetchCountriesSortsByName(t *testing.T) {
	c := newTestClient(t, map[string]string{
		"/configuration/countries": `[
			{"iso_3166_1": "DE", "english_name": "Germany"},
			{"iso_3166_1": "", "english_name": "Nowhere"},
			{"iso_3166_1": "AT", "english_name": "austria"}
		]`,
	})

	countries, err := c.FetchCountries(t.Context())
	require.NoError(t, err)
	assert.Equal(t, []Country{{Code: "AT", Name: "austria"}, {Code: "DE", Name: "Germany"}}, countries)
}
