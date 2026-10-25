package tmdb_test

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/handsomefox/paired-ratings/backend/tmdb"
	"github.com/handsomefox/paired-ratings/backend/tmdb/tmdbtest"
)

func TestDiscoverCachesEqualFilters(t *testing.T) {
	calls := 0
	c := tmdb.NewCachedClient(&tmdbtest.Mock{
		DiscoverPageFunc: func(context.Context, string, *tmdb.DiscoverFilters, int) (tmdb.SearchPage, error) {
			calls++
			return tmdb.SearchPage{TotalResults: calls}, nil
		},
	})
	ctx := t.Context()

	// Equal filters in separate allocations must share one cache entry.
	year, votes := 2020, 50
	first := tmdb.DiscoverFilters{YearFrom: &year, MinVotes: &votes, Sort: "popularity.desc"}
	otherYear, otherVotes := 2020, 50
	second := tmdb.DiscoverFilters{YearFrom: &otherYear, MinVotes: &otherVotes, Sort: "popularity.desc"}

	page, err := c.DiscoverPage(ctx, "movie", &first, 1)
	require.NoError(t, err)
	require.Equal(t, 1, page.TotalResults)
	page, err = c.DiscoverPage(ctx, "movie", &second, 1)
	require.NoError(t, err)
	require.Equal(t, 1, page.TotalResults)
	require.Equal(t, 1, calls)

	// A different value must miss.
	laterYear := 2021
	third := tmdb.DiscoverFilters{YearFrom: &laterYear, MinVotes: &votes, Sort: "popularity.desc"}
	page, err = c.DiscoverPage(ctx, "movie", &third, 1)
	require.NoError(t, err)
	require.Equal(t, 2, page.TotalResults)
	require.Equal(t, 2, calls)
}

func TestRefreshReplacesCachedMetadata(t *testing.T) {
	detailCalls, seasonCalls := 0, 0
	fail := false
	upstreamErr := errors.New("TMDB unavailable")
	c := tmdb.NewCachedClient(&tmdbtest.Mock{
		FetchDetailsFunc: func(context.Context, int64, string) (*tmdb.Detail, error) {
			detailCalls++
			if fail {
				return nil, upstreamErr
			}
			return &tmdb.Detail{Title: "current", NumberOfSeasons: detailCalls}, nil
		},
		FetchSeasonFunc: func(context.Context, int64, int) (tmdb.Season, error) {
			seasonCalls++
			if fail {
				return tmdb.Season{}, upstreamErr
			}
			return tmdb.Season{Episodes: []tmdb.Episode{{EpisodeNumber: seasonCalls}}}, nil
		},
	})
	ctx := t.Context()
	for range 2 {
		detail, err := c.FetchDetails(ctx, 1, "tv")
		require.NoError(t, err)
		require.Equal(t, 1, detail.NumberOfSeasons)
		season, err := c.FetchSeason(ctx, 1, 1)
		require.NoError(t, err)
		require.Equal(t, 1, season.Episodes[0].EpisodeNumber)
	}
	detail, err := c.RefreshDetails(ctx, 1, "tv")
	require.NoError(t, err)
	require.Equal(t, 2, detail.NumberOfSeasons)
	season, err := c.RefreshSeason(ctx, 1, 1)
	require.NoError(t, err)
	require.Equal(t, 2, season.Episodes[0].EpisodeNumber)
	fail = true
	_, err = c.RefreshDetails(ctx, 1, "tv")
	require.ErrorIs(t, err, upstreamErr)
	_, err = c.RefreshSeason(ctx, 1, 1)
	require.ErrorIs(t, err, upstreamErr)
	detail, err = c.FetchDetails(ctx, 1, "tv")
	require.NoError(t, err)
	require.Equal(t, 2, detail.NumberOfSeasons)
	season, err = c.FetchSeason(ctx, 1, 1)
	require.NoError(t, err)
	require.Equal(t, 2, season.Episodes[0].EpisodeNumber)
	require.Equal(t, 3, detailCalls)
	require.Equal(t, 3, seasonCalls)
}
