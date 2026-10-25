package handlers

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/handsomefox/paired-ratings/backend/store"
	"github.com/handsomefox/paired-ratings/backend/tmdb"
)

func TestParseGenreFilter(t *testing.T) {
	ids, matchAny, raw := parseGenreFilter("")
	assert.Empty(t, ids)
	assert.False(t, matchAny)
	assert.Empty(t, raw)

	ids, matchAny, raw = parseGenreFilter("12, 34, nope")
	assert.Equal(t, []int{12, 34}, ids)
	assert.False(t, matchAny)
	assert.Equal(t, "12,34", raw)

	ids, matchAny, raw = parseGenreFilter("5|7|0")
	assert.Equal(t, []int{5, 7}, ids)
	assert.True(t, matchAny)
	assert.Equal(t, "5|7", raw)
}

func TestMatchesGenres(t *testing.T) {
	itemIDs := []int{1, 2, 3}
	assert.True(t, matchesGenres(itemIDs, []int{2, 4}, true))
	assert.False(t, matchesGenres(itemIDs, []int{2, 4}, false))
	assert.True(t, matchesGenres(itemIDs, []int{1, 3}, false))
}

func TestParseSearchFilters(t *testing.T) {
	f := parseSearchFilters(url.Values{
		"media_type":        {" tv "},
		"year_from":         {"2020"},
		"year_to":           {"2021"},
		"min_rating":        {"7.2"},
		"min_votes":         {"100"},
		"sort":              {"year"},
		"genres":            {"12|16"},
		"origin_country":    {"us"},
		"original_language": {"EN"},
		"page":              {"2"},
	})
	assert.Equal(t, "tv", f.MediaType)
	assert.Equal(t, new(2020), f.YearFrom)
	assert.Equal(t, new(2021), f.YearTo)
	require.NotNil(t, f.MinRating)
	assert.InDelta(t, 7.2, *f.MinRating, 0.001)
	assert.Equal(t, new(100), f.MinVotes)
	assert.Equal(t, sortYear, f.Sort)
	assert.Equal(t, []int{12, 16}, f.GenreIDs)
	assert.True(t, f.GenreMatchAny)
	assert.Equal(t, "US", f.OriginCountry)
	assert.Equal(t, "en", f.OriginalLanguage)
	assert.Equal(t, 2, f.Page)
	assert.True(t, f.narrows())

	f = parseSearchFilters(url.Values{"media_type": {"book"}, "sort": {"chaos"}, "page": {"9999"}, "min_votes": {"-3"}})
	assert.Empty(t, f.MediaType)
	assert.Equal(t, sortRelevance, f.Sort)
	assert.Equal(t, maxPage, f.Page)
	assert.Nil(t, f.MinVotes)
	assert.False(t, f.narrows())
}

func TestSortResults(t *testing.T) {
	items := []tmdb.SearchResult{
		{Title: "b", VoteAverage: 7, VoteCount: 10, Year: "2001", Popularity: 3},
		{Title: "A", VoteAverage: 9, VoteCount: 5, Year: "1999", Popularity: 1},
		{Title: "c", VoteAverage: 7, VoteCount: 20, Year: "", Popularity: 2},
	}
	titles := func(sort searchSort) []string {
		sorted := append([]tmdb.SearchResult(nil), items...)
		sortResults(sorted, sort)
		out := make([]string, 0, len(sorted))
		for _, item := range sorted {
			out = append(out, item.Title)
		}
		return out
	}
	assert.Equal(t, []string{"A", "c", "b"}, titles(sortRating))
	assert.Equal(t, []string{"c", "b", "A"}, titles(sortVotes))
	assert.Equal(t, []string{"b", "A", "c"}, titles(sortYear))
	assert.Equal(t, []string{"A", "b", "c"}, titles(sortTitle))
	assert.Equal(t, []string{"b", "c", "A"}, titles(sortPopularity))
	assert.Equal(t, []string{"b", "A", "c"}, titles(sortRelevance))
}

func TestPaginate(t *testing.T) {
	items := make([]tmdb.SearchResult, 45)
	assert.Len(t, paginate(items, 1).Results, 20)
	last := paginate(items, 3)
	assert.Len(t, last.Results, 5)
	assert.Equal(t, 3, last.TotalPages)
	assert.Equal(t, 45, last.TotalResults)
	assert.Empty(t, paginate(items, 9).Results)
}

func TestParseListFilters(t *testing.T) {
	parse := func(query string) *store.ListFilters {
		t.Helper()
		r := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/shows?"+query, http.NoBody)
		f, err := parseListFilters(r)
		require.NoError(t, err)
		return f
	}

	f := parse("status=planned&origin_country=us&unrated=1&page=3&page_size=50&sort=avg&year_from=2000")
	assert.Equal(t, store.StatusPlanned, f.Status)
	assert.Equal(t, "US", f.Country)
	assert.True(t, f.Unrated)
	assert.Equal(t, 3, f.Page)
	assert.Equal(t, 50, f.PageSize)
	assert.Equal(t, store.SortAverage, f.Sort)
	assert.Equal(t, new(int64(2000)), f.YearFrom)

	f = parse("status=all&page_size=all&sort=chaos&page=-1")
	assert.Empty(t, f.Status)
	assert.Zero(t, f.PageSize)
	assert.Equal(t, store.SortCreated, f.Sort)
	assert.Equal(t, 1, f.Page)

	assert.Equal(t, 20, parse("page_size=7").PageSize)
}
