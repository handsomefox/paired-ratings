package tmdb

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestCacheExpiryAndCapacity(t *testing.T) {
	c := newCache[int, string]()

	// An expired entry never reads back, and the next set drops it.
	c.set(-1, "expired", -time.Second)
	_, ok := c.get(-1)
	require.False(t, ok)
	c.set(0, "first", time.Hour)
	require.NotContains(t, c.entries, -1)

	// Filling the cache evicts the entry that expires first, here key 0.
	for i := 1; i < maxCacheEntries; i++ {
		c.set(i, "later", 2*time.Hour)
	}
	c.set(maxCacheEntries, "new", 2*time.Hour)
	require.Len(t, c.entries, maxCacheEntries)
	require.NotContains(t, c.entries, 0)

	// Overwriting an existing key does not grow the cache.
	c.set(maxCacheEntries, "updated", 2*time.Hour)
	require.Len(t, c.entries, maxCacheEntries)
	value, ok := c.get(maxCacheEntries)
	require.True(t, ok)
	require.Equal(t, "updated", value)
}

func TestCacheConcurrentAccess(t *testing.T) {
	c := newCache[int, int]()
	var wg sync.WaitGroup
	for worker := range 8 {
		wg.Go(func() {
			for i := range maxCacheEntries {
				key := worker*maxCacheEntries + i
				c.set(key, i, time.Minute)
				c.get(key)
			}
		})
	}
	wg.Wait()
	require.LessOrEqual(t, len(c.entries), maxCacheEntries)
}

func TestDiscoverCachesEqualFilters(t *testing.T) {
	calls := 0
	c := NewCachedClient(&Mock{
		DiscoverPageFunc: func(context.Context, string, *DiscoverFilters, int) (SearchPage, error) {
			calls++
			return SearchPage{TotalResults: calls}, nil
		},
	})
	ctx := t.Context()

	// Equal filters in separate allocations must share one cache entry.
	year, votes := 2020, 50
	first := DiscoverFilters{YearFrom: &year, MinVotes: &votes, Sort: "popularity.desc"}
	otherYear, otherVotes := 2020, 50
	second := DiscoverFilters{YearFrom: &otherYear, MinVotes: &otherVotes, Sort: "popularity.desc"}

	page, err := c.DiscoverPage(ctx, "movie", &first, 1)
	require.NoError(t, err)
	require.Equal(t, 1, page.TotalResults)
	page, err = c.DiscoverPage(ctx, "movie", &second, 1)
	require.NoError(t, err)
	require.Equal(t, 1, page.TotalResults)
	require.Equal(t, 1, calls)

	// A different value must miss.
	laterYear := 2021
	third := DiscoverFilters{YearFrom: &laterYear, MinVotes: &votes, Sort: "popularity.desc"}
	page, err = c.DiscoverPage(ctx, "movie", &third, 1)
	require.NoError(t, err)
	require.Equal(t, 2, page.TotalResults)
	require.Equal(t, 2, calls)
}

func TestRefreshReplacesCachedMetadata(t *testing.T) {
	detailCalls, seasonCalls := 0, 0
	fail := false
	upstreamErr := errors.New("TMDB unavailable")
	c := NewCachedClient(&Mock{
		FetchDetailsFunc: func(context.Context, int64, string) (*Detail, error) {
			detailCalls++
			if fail {
				return nil, upstreamErr
			}
			return &Detail{Title: "current", NumberOfSeasons: detailCalls}, nil
		},
		FetchSeasonFunc: func(context.Context, int64, int) (Season, error) {
			seasonCalls++
			if fail {
				return Season{}, upstreamErr
			}
			return Season{Episodes: []Episode{{EpisodeNumber: seasonCalls}}}, nil
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
