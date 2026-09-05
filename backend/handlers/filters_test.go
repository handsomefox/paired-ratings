package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/handsomefox/paired-ratings/backend/gen/pb"
	"github.com/handsomefox/paired-ratings/backend/tmdb"
	"github.com/stretchr/testify/require"
)

func TestParseGenreFilter(t *testing.T) {
	ids, mode, raw := parseGenreFilter("")
	require.Empty(t, ids)
	require.Equal(t, "and", mode)
	require.Empty(t, raw)

	ids, mode, raw = parseGenreFilter("12, 34, nope")
	require.Equal(t, []int{12, 34}, ids)
	require.Equal(t, "and", mode)
	require.Equal(t, "12,34", raw)

	ids, mode, raw = parseGenreFilter("5|7|0")
	require.Equal(t, []int{5, 7}, ids)
	require.Equal(t, "or", mode)
	require.Equal(t, "5|7", raw)
}

func TestMatchesGenres(t *testing.T) {
	itemIDs := []int{1, 2, 3}
	require.True(t, matchesGenres(itemIDs, []int{2, 4}, "or"))
	require.False(t, matchesGenres(itemIDs, []int{2, 4}, "and"))
}

func TestSearchFiltersFromRequest(t *testing.T) {
	req := &pb.SearchRequest{
		MediaType:        " tv ",
		YearFrom:         "2020",
		YearTo:           "2021",
		MinRating:        "7.2",
		MinVotes:         "100",
		Sort:             "year",
		Genres:           "12|16",
		OriginCountry:    "us",
		OriginalLanguage: "EN",
		Page:             2,
	}

	filters := searchFiltersFromRequest(req)
	require.Equal(t, "tv", filters.MediaType)
	require.NotNil(t, filters.YearFrom)
	require.Equal(t, 2020, *filters.YearFrom)
	require.NotNil(t, filters.YearTo)
	require.Equal(t, 2021, *filters.YearTo)
	require.NotNil(t, filters.MinRating)
	require.InDelta(t, 7.2, *filters.MinRating, 0.001)
	require.NotNil(t, filters.MinVotes)
	require.Equal(t, 100, *filters.MinVotes)
	require.Equal(t, "year", filters.Sort)
	require.Equal(t, 2, filters.Page)
	require.Equal(t, []int{12, 16}, filters.GenreIDs)
	require.Equal(t, "or", filters.GenreMode)
	require.Equal(t, "12|16", filters.GenreRaw)
	require.Equal(t, "US", filters.OriginCountry)
	require.Equal(t, "en", filters.OriginalLanguage)
}

func TestApplySearchSortRating(t *testing.T) {
	items := []tmdb.SearchResult{
		{Title: "B", VoteAverage: 8.0, VoteCount: 10},
		{Title: "A", VoteAverage: 8.0, VoteCount: 20},
		{Title: "C", VoteAverage: 9.0, VoteCount: 1},
	}

	sorted := applySearchSort(items, "rating", false)
	require.Equal(t, "C", sorted[0].Title)
	require.Equal(t, "A", sorted[1].Title)
	require.Equal(t, "B", sorted[2].Title)
}

func TestParseListFilters(t *testing.T) {
	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/shows?status=planned&genre=Drama&origin_country=us&sort=year&unrated=1&year_from=2020&year_to=2021", http.NoBody)

	filters := parseListFilters(req)
	require.Equal(t, "planned", filters.Status)
	require.Equal(t, "Drama", filters.Genre)
	require.Equal(t, "US", filters.Country)
	require.Equal(t, "year", filters.Sort)
	require.True(t, filters.Unrated)
	require.NotNil(t, filters.YearFrom)
	require.Equal(t, 2020, *filters.YearFrom)
	require.NotNil(t, filters.YearTo)
	require.Equal(t, 2021, *filters.YearTo)
}

func TestParseSearchRequest(t *testing.T) {
	req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/search?q=foo&media_type=tv&year_from=2020&year_to=2021&min_rating=7.2&min_votes=50&sort=rating&genres=12|16&origin_country=US&original_language=EN&page=3", http.NoBody)

	parsed := parseSearchRequest(req)
	require.Equal(t, "foo", parsed.Q)
	require.Equal(t, "tv", parsed.MediaType)
	require.Equal(t, "2020", parsed.YearFrom)
	require.Equal(t, "2021", parsed.YearTo)
	require.Equal(t, "7.2", parsed.MinRating)
	require.Equal(t, "50", parsed.MinVotes)
	require.Equal(t, "rating", parsed.Sort)
	require.Equal(t, "12|16", parsed.Genres)
	require.Equal(t, "US", parsed.OriginCountry)
	require.Equal(t, "EN", parsed.OriginalLanguage)
	require.Equal(t, int32(3), parsed.Page)
}

func TestSearchFiltersIsEmpty(t *testing.T) {
	require.True(t, (&searchFilters{MediaType: "all"}).isEmpty())
	require.False(t, (&searchFilters{MediaType: "movie"}).isEmpty())
	year := 2024
	require.False(t, (&searchFilters{MediaType: "all", YearFrom: &year}).isEmpty())
}

func TestPaginateSearchResults(t *testing.T) {
	items := []tmdb.SearchResult{{ID: 1}, {ID: 2}, {ID: 3}}

	paged := paginateSearchResults(items, 1, 2)
	require.Len(t, paged, 2)
	require.Equal(t, int64(2), paged[0].ID)
	require.Equal(t, int64(3), paged[1].ID)

	require.Empty(t, paginateSearchResults(items, 10, 2))
}

func TestGenreNamesFor(t *testing.T) {
	movieGenres := map[int]string{1: "Action", 2: "Drama"}
	tvGenres := map[int]string{3: "Crime"}

	movieItem := tmdb.SearchResult{MediaType: "movie", GenreIDs: []int{2, 1}}
	movieNames := genreNamesFor(&movieItem, movieGenres, tvGenres)
	require.ElementsMatch(t, []string{"Action", "Drama"}, movieNames)

	tvItem := tmdb.SearchResult{MediaType: "tv", GenreIDs: []int{3}}
	tvNames := genreNamesFor(&tvItem, movieGenres, tvGenres)
	require.Equal(t, []string{"Crime"}, tvNames)
}

func TestParseOptionalRating(t *testing.T) {
	require.False(t, parseOptionalRating(nil).Valid)

	val := int32(0)
	rating := parseOptionalRating(&val)
	require.True(t, rating.Valid)
	require.Equal(t, int64(1), rating.V)

	val = 12
	rating = parseOptionalRating(&val)
	require.Equal(t, int64(10), rating.V)
}
