package tmdb

import (
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
