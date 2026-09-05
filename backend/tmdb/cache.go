package tmdb

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ttl cache durations
const (
	ttlStatic  = 24 * time.Hour   // genres, countries, languages: almost never change
	ttlDetail  = 24 * time.Hour   // show details: user can force-refresh via the UI
	ttlSeason  = 6 * time.Hour    // season/episode data
	ttlRelated = 6 * time.Hour    // collections, similar
	ttlSearch  = 10 * time.Minute // search & discover results

	// maxCacheEntries bounds each cache. Reaching it evicts the entry that
	// expires first.
	maxCacheEntries = 256
)

// ttlCache is a generic in-memory cache with per-entry TTLs. Safe for concurrent use.
type ttlCache[K comparable, V any] struct {
	mu      sync.RWMutex
	entries map[K]ttlEntry[V]
}

type ttlEntry[V any] struct {
	value     V
	expiresAt time.Time
}

func newCache[K comparable, V any]() *ttlCache[K, V] {
	return &ttlCache[K, V]{entries: make(map[K]ttlEntry[V])}
}

func (c *ttlCache[K, V]) get(key K) (V, bool) {
	c.mu.RLock()
	e, ok := c.entries[key]
	c.mu.RUnlock()
	if !ok || time.Now().After(e.expiresAt) {
		var zero V
		return zero, false
	}
	return e.value, true
}

// set stores the value and drops every expired entry. If the cache is still at
// capacity, it also drops the entry that expires first.
func (c *ttlCache[K, V]) set(key K, value V, ttl time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	now := time.Now()
	for k, e := range c.entries {
		if now.After(e.expiresAt) {
			delete(c.entries, k)
		}
	}
	if _, exists := c.entries[key]; !exists && len(c.entries) >= maxCacheEntries {
		var oldest K
		var earliest time.Time
		for k, e := range c.entries {
			if earliest.IsZero() || e.expiresAt.Before(earliest) {
				oldest, earliest = k, e.expiresAt
			}
		}
		delete(c.entries, oldest)
	}
	c.entries[key] = ttlEntry[V]{value: value, expiresAt: now.Add(ttl)}
}

// CachedClient wraps an Interface and caches responses that are safe to reuse.
type CachedClient struct {
	inner       Interface
	details     *ttlCache[string, *Detail]
	genres      *ttlCache[string, []Genre]
	countries   *ttlCache[string, []Country]
	languages   *ttlCache[string, []Language]
	search      *ttlCache[string, SearchPage]
	discover    *ttlCache[string, SearchPage]
	collections *ttlCache[int64, []SearchResult]
	similar     *ttlCache[string, []SearchResult]
	seasons     *ttlCache[string, Season]
}

// NewCachedClient wraps inner with an in-memory TTL cache.
func NewCachedClient(inner Interface) *CachedClient {
	return &CachedClient{
		inner:       inner,
		details:     newCache[string, *Detail](),
		genres:      newCache[string, []Genre](),
		countries:   newCache[string, []Country](),
		languages:   newCache[string, []Language](),
		search:      newCache[string, SearchPage](),
		discover:    newCache[string, SearchPage](),
		collections: newCache[int64, []SearchResult](),
		similar:     newCache[string, []SearchResult](),
		seasons:     newCache[string, Season](),
	}
}

var _ Interface = (*CachedClient)(nil)

func (c *CachedClient) FetchDetails(ctx context.Context, id int64, mediaType string) (*Detail, error) {
	key := fmt.Sprintf("%s:%d", mediaType, id)
	if v, ok := c.details.get(key); ok {
		return v, nil
	}
	return c.RefreshDetails(ctx, id, mediaType)
}

// RefreshDetails bypasses the cache and replaces it only after a successful fetch.
func (c *CachedClient) RefreshDetails(ctx context.Context, id int64, mediaType string) (*Detail, error) {
	key := fmt.Sprintf("%s:%d", mediaType, id)
	v, err := c.inner.RefreshDetails(ctx, id, mediaType)
	if err != nil {
		return nil, err
	}
	c.details.set(key, v, ttlDetail)
	return v, nil
}

func (c *CachedClient) FetchGenres(ctx context.Context, mediaType string) ([]Genre, error) {
	if v, ok := c.genres.get(mediaType); ok {
		return v, nil
	}
	v, err := c.inner.FetchGenres(ctx, mediaType)
	if err != nil {
		return nil, err
	}
	c.genres.set(mediaType, v, ttlStatic)
	return v, nil
}

func (c *CachedClient) FetchCountries(ctx context.Context) ([]Country, error) {
	if v, ok := c.countries.get("_"); ok {
		return v, nil
	}
	v, err := c.inner.FetchCountries(ctx)
	if err != nil {
		return nil, err
	}
	c.countries.set("_", v, ttlStatic)
	return v, nil
}

func (c *CachedClient) FetchLanguages(ctx context.Context) ([]Language, error) {
	if v, ok := c.languages.get("_"); ok {
		return v, nil
	}
	v, err := c.inner.FetchLanguages(ctx)
	if err != nil {
		return nil, err
	}
	c.languages.set("_", v, ttlStatic)
	return v, nil
}

func (c *CachedClient) SearchPage(ctx context.Context, query, mediaType string, page int) (SearchPage, error) {
	key := fmt.Sprintf("%s:%s:%d", mediaType, query, page)
	if v, ok := c.search.get(key); ok {
		return v, nil
	}
	v, err := c.inner.SearchPage(ctx, query, mediaType, page)
	if err != nil {
		return SearchPage{}, err
	}
	c.search.set(key, v, ttlSearch)
	return v, nil
}

// cacheKey renders the filters by value. Formatting the struct with %v prints
// the addresses of its four pointer fields, which differ on every request, so
// the discover cache would never hit. Each part is quoted, because Genres holds
// a raw TMDB filter that can contain the separator.
func (f *DiscoverFilters) cacheKey() string {
	return strings.Join([]string{
		optional(f.YearFrom),
		optional(f.YearTo),
		optional(f.MinRating),
		optional(f.MinVotes),
		strconv.Quote(f.Genres),
		strconv.Quote(f.Sort),
		strconv.Quote(f.OriginCountry),
		strconv.Quote(f.OriginalLanguage),
	}, "|")
}

func optional[T any](p *T) string {
	if p == nil {
		return ""
	}
	return strconv.Quote(fmt.Sprint(*p))
}

func (c *CachedClient) DiscoverPage(ctx context.Context, mediaType string, filters *DiscoverFilters, page int) (SearchPage, error) {
	key := fmt.Sprintf("%s:%s:%d", mediaType, filters.cacheKey(), page)
	if v, ok := c.discover.get(key); ok {
		return v, nil
	}
	v, err := c.inner.DiscoverPage(ctx, mediaType, filters, page)
	if err != nil {
		return SearchPage{}, err
	}
	c.discover.set(key, v, ttlSearch)
	return v, nil
}

func (c *CachedClient) FetchCollection(ctx context.Context, collectionID int64) ([]SearchResult, error) {
	if v, ok := c.collections.get(collectionID); ok {
		return v, nil
	}
	v, err := c.inner.FetchCollection(ctx, collectionID)
	if err != nil {
		return nil, err
	}
	c.collections.set(collectionID, v, ttlRelated)
	return v, nil
}

func (c *CachedClient) FetchSimilar(ctx context.Context, id int64, mediaType string) ([]SearchResult, error) {
	key := fmt.Sprintf("%s:%d", mediaType, id)
	if v, ok := c.similar.get(key); ok {
		return v, nil
	}
	v, err := c.inner.FetchSimilar(ctx, id, mediaType)
	if err != nil {
		return nil, err
	}
	c.similar.set(key, v, ttlRelated)
	return v, nil
}

func (c *CachedClient) FetchSeason(ctx context.Context, showID int64, seasonNumber int) (Season, error) {
	key := fmt.Sprintf("%d:%d", showID, seasonNumber)
	if v, ok := c.seasons.get(key); ok {
		return v, nil
	}
	return c.RefreshSeason(ctx, showID, seasonNumber)
}

// RefreshSeason fetches current episode metadata and updates the cache.
func (c *CachedClient) RefreshSeason(ctx context.Context, showID int64, seasonNumber int) (Season, error) {
	key := fmt.Sprintf("%d:%d", showID, seasonNumber)
	v, err := c.inner.RefreshSeason(ctx, showID, seasonNumber)
	if err != nil {
		return Season{}, err
	}
	c.seasons.set(key, v, ttlSeason)
	return v, nil
}
