package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/handsomefox/paired-ratings/backend/gen/pb"
	"github.com/handsomefox/paired-ratings/backend/store"
	"github.com/handsomefox/paired-ratings/backend/tmdb"
	"github.com/handsomefox/paired-ratings/backend/tmdb/tmdbtest"
)

const testPassword = "secret"

// client drives the API routes with a session cookie.
type client struct {
	t      *testing.T
	h      *Handler
	router http.Handler
	cookie *http.Cookie
}

func newTestStore(t *testing.T) *store.Store {
	t.Helper()
	st, err := store.Open(t.Context(), filepath.Join(t.TempDir(), "ratings.db"))
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, st.Close()) })
	return st
}

func newTestHandler(t *testing.T, st *store.Store, api tmdb.Interface) *Handler {
	t.Helper()
	if api == nil {
		api = &tmdbtest.Mock{}
	}
	h, err := New(&Config{
		Store:      st,
		TMDB:       api,
		Password:   testPassword,
		SessionKey: bytes.Repeat([]byte{7}, sessionKeySize),
		ImageBase:  "https://img.example",
		BfName:     "BF",
		GfName:     "GF",
	})
	require.NoError(t, err)
	return h
}

// newAnonymousClient returns a client without a session.
func newAnonymousClient(t *testing.T, st *store.Store, api tmdb.Interface) *client {
	t.Helper()
	h := newTestHandler(t, st, api)
	r := chi.NewRouter()
	h.RegisterRoutes(r)
	return &client{t: t, h: h, router: r}
}

// newClient returns a signed-in client.
func newClient(t *testing.T, st *store.Store, api tmdb.Interface) *client {
	t.Helper()
	c := newAnonymousClient(t, st, api)
	rec := c.do(http.MethodPost, "/login", &pb.LoginRequest{Password: testPassword})
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	cookies := rec.Result().Cookies()
	require.Len(t, cookies, 1)
	c.cookie = cookies[0]
	return c
}

func (c *client) do(method, path string, body any) *httptest.ResponseRecorder {
	c.t.Helper()
	var reader io.Reader = http.NoBody
	if body != nil {
		payload, err := json.Marshal(body)
		require.NoError(c.t, err)
		reader = bytes.NewReader(payload)
	}
	req := httptest.NewRequestWithContext(c.t.Context(), method, path, reader)
	if c.cookie != nil {
		req.AddCookie(c.cookie)
	}
	rec := httptest.NewRecorder()
	c.router.ServeHTTP(rec, req)
	return rec
}

// decode checks the status and decodes the body into a new T.
func decode[T any](t *testing.T, rec *httptest.ResponseRecorder, status int) *T {
	t.Helper()
	require.Equal(t, status, rec.Code, rec.Body.String())
	var out T
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&out))
	return &out
}

func addTestShow(t *testing.T, st *store.Store, tmdbID int64, mediaType store.MediaType) int64 {
	t.Helper()
	id, err := st.UpsertShow(t.Context(), &store.Metadata{
		TMDBID:    tmdbID,
		MediaType: mediaType,
		Title:     "Show " + strconv.FormatInt(tmdbID, 10),
	}, store.StatusPlanned)
	require.NoError(t, err)
	return id
}

func showPath(id int64, rest string) string {
	return "/shows/" + formatID(id) + rest
}

func formatID(id int64) string {
	return strconv.FormatInt(id, 10)
}

func TestAdaptErrors(t *testing.T) {
	serve := func(err error) *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		h := logRequests(Adapt(func(http.ResponseWriter, *http.Request) error { return err }))
		h.ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/", http.NoBody))
		return rec
	}

	body := decode[pb.ErrorResponse](t, serve(badRequest("bad request")), http.StatusBadRequest)
	assert.Equal(t, "bad request", body.Error)

	// A plain error is a 500 that keeps its details out of the response.
	body = decode[pb.ErrorResponse](t, serve(errors.New("disk I/O error at /app/data")), http.StatusInternalServerError)
	assert.Equal(t, "internal server error", body.Error)

	body = decode[pb.ErrorResponse](t, serve(badGateway(errors.New("tmdb /3/movie/1: 500"))), http.StatusBadGateway)
	assert.Equal(t, "TMDB request failed", body.Error)

	// A deadline wins over the status it is wrapped in.
	body = decode[pb.ErrorResponse](t, serve(badGateway(context.DeadlineExceeded)), http.StatusGatewayTimeout)
	assert.Equal(t, "request timed out", body.Error)

	rec := httptest.NewRecorder()
	panics := logRequests(http.HandlerFunc(func(http.ResponseWriter, *http.Request) { panic("boom") }))
	panics.ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/", http.NoBody))
	body = decode[pb.ErrorResponse](t, rec, http.StatusInternalServerError)
	assert.Equal(t, "internal server error", body.Error)
}

func TestRequestBodyLimit(t *testing.T) {
	c := newAnonymousClient(t, newTestStore(t), nil)
	huge := &pb.LoginRequest{Password: strings.Repeat("x", maxBodyBytes)}
	assert.Equal(t, http.StatusBadRequest, c.do(http.MethodPost, "/login", huge).Code)
}

func TestReorderShows(t *testing.T) {
	st := newTestStore(t)
	first := addTestShow(t, st, 1, store.MediaMovie)
	second := addTestShow(t, st, 2, store.MediaMovie)
	c := newClient(t, st, nil)

	assert.Equal(t, http.StatusNoContent, c.do(http.MethodPost, "/shows/reorder", &pb.ReorderRequest{OrderedIds: []int64{second, first}}).Code)
	list := decode[pb.ListResponse](t, c.do(http.MethodGet, "/shows/?sort=priority", nil), http.StatusOK)
	require.Len(t, list.Shows, 2)
	assert.Equal(t, []int64{second, first}, []int64{list.Shows[0].Id, list.Shows[1].Id})

	assert.Equal(t, http.StatusBadRequest, c.do(http.MethodPost, "/shows/reorder", &pb.ReorderRequest{}).Code)
	assert.Equal(t, http.StatusNotFound, c.do(http.MethodPost, "/shows/reorder", &pb.ReorderRequest{OrderedIds: []int64{999}}).Code)
}

func TestAuth(t *testing.T) {
	st := newTestStore(t)
	addTestShow(t, st, 1, store.MediaMovie)
	c := newClient(t, st, nil)

	session := decode[pb.SessionResponse](t, c.do(http.MethodGet, "/session", nil), http.StatusOK)
	assert.True(t, *session.Authenticated)
	assert.Equal(t, "BF", *session.BfName)

	list := decode[pb.ListResponse](t, c.do(http.MethodGet, "/shows/", nil), http.StatusOK)
	assert.Len(t, list.Shows, 1)

	// The cookie is an HMAC of the password, not a hash anyone can compute.
	assert.NotEqual(t, sessionToken(bytes.Repeat([]byte{8}, sessionKeySize), testPassword), c.cookie.Value)
	assert.Equal(t, http.SameSiteLaxMode, c.cookie.SameSite)
	assert.True(t, c.cookie.HttpOnly)

	anonymous := &client{t: t, h: c.h, router: c.router}
	body := decode[pb.ErrorResponse](t, anonymous.do(http.MethodGet, "/shows/", nil), http.StatusUnauthorized)
	assert.Equal(t, "unauthorized", body.Error)
	session = decode[pb.SessionResponse](t, anonymous.do(http.MethodGet, "/session", nil), http.StatusOK)
	assert.False(t, *session.Authenticated)

	//nolint:gosec // G124: a request cookie carries no response flags.
	forged := &client{t: t, h: c.h, router: c.router, cookie: &http.Cookie{Name: authCookieName, Value: "00"}}
	assert.Equal(t, http.StatusUnauthorized, forged.do(http.MethodGet, "/shows/", nil).Code)

	logout := c.do(http.MethodPost, "/logout", nil)
	require.Equal(t, http.StatusOK, logout.Code)
	cleared := logout.Result().Cookies()
	require.Len(t, cleared, 1)
	assert.Negative(t, cleared[0].MaxAge)
}

func TestLoginRateLimit(t *testing.T) {
	c := newAnonymousClient(t, newTestStore(t), nil)

	for range loginFailureLimit {
		rec := c.do(http.MethodPost, "/login", &pb.LoginRequest{Password: "wrong"})
		require.Equal(t, http.StatusUnauthorized, rec.Code)
	}
	// Even the right password waits until the window passes.
	rec := c.do(http.MethodPost, "/login", &pb.LoginRequest{Password: testPassword})
	require.Equal(t, http.StatusTooManyRequests, rec.Code)

	c.h.logins.mu.Lock()
	for i := range c.h.logins.failures {
		c.h.logins.failures[i] = c.h.logins.failures[i].Add(-loginFailureWindow)
	}
	c.h.logins.mu.Unlock()
	rec = c.do(http.MethodPost, "/login", &pb.LoginRequest{Password: testPassword})
	require.Equal(t, http.StatusOK, rec.Code)
}

func TestShowLifecycle(t *testing.T) {
	st := newTestStore(t)
	id := addTestShow(t, st, 2, store.MediaMovie)
	c := newClient(t, st, nil)

	detail := decode[pb.ShowDetail](t, c.do(http.MethodPost, showPath(id, "/ratings"),
		&pb.RatingsRequest{BfRating: new(int32(7)), GfComment: new("  Great  ")}), http.StatusOK)
	assert.Equal(t, new(int64(7)), detail.Show.BfRating)
	assert.Equal(t, new("Great"), detail.Show.GfComment)

	assert.Equal(t, http.StatusBadRequest, c.do(http.MethodPost, showPath(id, "/ratings"), &pb.RatingsRequest{GfRating: new(int32(11))}).Code)
	assert.Equal(t, http.StatusBadRequest, c.do(http.MethodPost, showPath(id, "/ratings"), &pb.RatingsRequest{}).Code)

	// An empty comment clears it.
	detail = decode[pb.ShowDetail](t, c.do(http.MethodPost, showPath(id, "/ratings"),
		&pb.RatingsRequest{GfComment: new("")}), http.StatusOK)
	assert.Nil(t, detail.Show.GfComment)
	assert.Equal(t, new(int64(7)), detail.Show.BfRating)

	detail = decode[pb.ShowDetail](t, c.do(http.MethodPost, showPath(id, "/set-status"), &pb.SetStatusRequest{Status: "watched"}), http.StatusOK)
	assert.Equal(t, "watched", detail.Show.Status)
	assert.Equal(t, http.StatusBadRequest, c.do(http.MethodPost, showPath(id, "/set-status"), &pb.SetStatusRequest{Status: "dropped"}).Code)

	detail = decode[pb.ShowDetail](t, c.do(http.MethodPost, showPath(id, "/clear-ratings"), nil), http.StatusOK)
	assert.Nil(t, detail.Show.BfRating)

	detail = decode[pb.ShowDetail](t, c.do(http.MethodPost, showPath(id, "/watch-order"), nil), http.StatusOK)
	assert.Equal(t, new(int32(1)), detail.Show.WatchPriority)
	detail = decode[pb.ShowDetail](t, c.do(http.MethodDelete, showPath(id, "/watch-order"), nil), http.StatusOK)
	assert.Nil(t, detail.Show.WatchPriority)

	assert.Equal(t, http.StatusNoContent, c.do(http.MethodDelete, showPath(id, "/"), nil).Code)
	body := decode[pb.ErrorResponse](t, c.do(http.MethodGet, showPath(id, "/"), nil), http.StatusNotFound)
	assert.Equal(t, "not found", body.Error)
	assert.Equal(t, http.StatusNotFound, c.do(http.MethodPost, showPath(id, "/clear-ratings"), nil).Code)
	assert.Equal(t, http.StatusNotFound, c.do(http.MethodGet, "/no-such-route", nil).Code)
}

func TestAddShowKeepsExistingState(t *testing.T) {
	st := newTestStore(t)
	c := newClient(t, st, &tmdbtest.Mock{
		FetchDetailsFunc: func(_ context.Context, id int64, mediaType string) (*tmdb.Detail, error) {
			return &tmdb.Detail{TMDBID: id, MediaType: mediaType, Title: "Added", Genres: []string{"Drama", "Crime"}, IMDbID: "tt1"}, nil
		},
	})

	added := decode[pb.ShowDetail](t, c.do(http.MethodPost, "/shows/", &pb.AddShowRequest{TmdbId: 5, MediaType: "tv", Status: "watching"}), http.StatusOK)
	assert.Equal(t, "watching", added.Show.Status)
	assert.Equal(t, []string{"Drama", "Crime"}, added.Show.Genres)
	assert.Equal(t, new("https://www.imdb.com/title/tt1/"), added.ImdbUrl)

	again := decode[pb.ShowDetail](t, c.do(http.MethodPost, "/shows/", &pb.AddShowRequest{TmdbId: 5, MediaType: "tv"}), http.StatusOK)
	assert.Equal(t, added.Show.Id, again.Show.Id)
	assert.Equal(t, "watching", again.Show.Status)

	assert.Equal(t, http.StatusBadRequest, c.do(http.MethodPost, "/shows/", &pb.AddShowRequest{TmdbId: 5, MediaType: "book"}).Code)
	assert.Equal(t, http.StatusBadRequest, c.do(http.MethodPost, "/shows/", &pb.AddShowRequest{TmdbId: 5, MediaType: "tv", Status: "dropped"}).Code)
}

func TestListPageSizeAll(t *testing.T) {
	st := newTestStore(t)
	for i := range 25 {
		addTestShow(t, st, int64(i+1), store.MediaMovie)
	}
	c := newClient(t, st, nil)

	page := decode[pb.ListResponse](t, c.do(http.MethodGet, "/shows/", nil), http.StatusOK)
	assert.Len(t, page.Shows, 20)
	assert.Equal(t, int32(25), page.TotalCount)

	all := decode[pb.ListResponse](t, c.do(http.MethodGet, "/shows/?page_size=all", nil), http.StatusOK)
	assert.Len(t, all.Shows, 25)

	assert.Equal(t, http.StatusBadRequest, c.do(http.MethodGet, "/shows/?status=dropped", nil).Code)
	assert.Equal(t, http.StatusBadRequest, c.do(http.MethodGet, "/shows/?year_from=soon", nil).Code)
}

func TestSearchEndpoints(t *testing.T) {
	st := newTestStore(t)
	inLibrary := addTestShow(t, st, 10, store.MediaMovie)
	c := newClient(t, st, &tmdbtest.Mock{
		FetchGenresFunc: func(_ context.Context, mediaType string) ([]tmdb.Genre, error) {
			if mediaType == "movie" {
				return []tmdb.Genre{{ID: 1, Name: "Action"}}, nil
			}
			return []tmdb.Genre{{ID: 1, Name: "Talk"}}, nil
		},
		FetchCountriesFunc: func(context.Context) ([]tmdb.Country, error) {
			return []tmdb.Country{{Code: "US", Name: "United States"}}, nil
		},
		FetchLanguagesFunc: func(context.Context) ([]tmdb.Language, error) {
			return []tmdb.Language{{Code: "en", Name: "English"}}, nil
		},
		FetchDetailsFunc: func(_ context.Context, id int64, mediaType string) (*tmdb.Detail, error) {
			return &tmdb.Detail{TMDBID: id, IMDbID: "tt123", MediaType: mediaType}, nil
		},
		SearchPageFunc: func(_ context.Context, _, mediaType string, _ int) (tmdb.SearchPage, error) {
			return tmdb.SearchPage{
				Results: []tmdb.SearchResult{
					{ID: 10, MediaType: mediaType, Title: "Saved", GenreIDs: []int{1}},
					{ID: 11, MediaType: mediaType, Title: "New"},
				},
				Page: 1, TotalPages: 1, TotalResults: 2,
			}, nil
		},
	})

	genres := decode[pb.SearchGenresResponse](t, c.do(http.MethodGet, "/search/genres", nil), http.StatusOK)
	assert.Len(t, genres.MovieGenres, 1)
	countries := decode[pb.SearchCountriesResponse](t, c.do(http.MethodGet, "/search/countries", nil), http.StatusOK)
	assert.Equal(t, "US", countries.Countries[0].Code)
	languages := decode[pb.SearchLanguagesResponse](t, c.do(http.MethodGet, "/search/languages", nil), http.StatusOK)
	assert.Equal(t, "en", languages.Languages[0].Code)

	resolve := decode[pb.SearchResolveResponse](t, c.do(http.MethodGet, "/search/resolve?tmdb_id=10&media_type=movie", nil), http.StatusOK)
	assert.Equal(t, new("https://www.imdb.com/title/tt123/"), resolve.ImdbUrl)
	assert.Equal(t, new("https://www.themoviedb.org/movie/10"), resolve.TmdbUrl)

	search := decode[pb.SearchResponse](t, c.do(http.MethodGet, "/search?q=test&media_type=movie", nil), http.StatusOK)
	require.Len(t, search.Results, 2)
	assert.Equal(t, &inLibrary, search.Results[0].LibraryId)
	assert.Equal(t, []string{"Action"}, search.Results[0].Genres)
	assert.Nil(t, search.Results[1].LibraryId)

	assert.Equal(t, http.StatusBadRequest, c.do(http.MethodGet, "/search?q=test", nil).Code)
}

func TestFilteredSearchReadsABoundedWindow(t *testing.T) {
	var calls atomic.Int32
	c := newClient(t, newTestStore(t), &tmdbtest.Mock{
		SearchPageFunc: func(_ context.Context, _, mediaType string, page int) (tmdb.SearchPage, error) {
			calls.Add(1)
			// Every page has one match for the vote filter.
			return tmdb.SearchPage{
				Results: []tmdb.SearchResult{
					{ID: int64(page * 10), MediaType: mediaType, Title: "Popular", VoteCount: 1000, VoteAverage: float64(page % 7)},
					{ID: int64(page*10 + 1), MediaType: mediaType, Title: "Obscure", VoteCount: 1},
				},
				Page: page, TotalPages: 500, TotalResults: 10000,
			}, nil
		},
	})

	first := decode[pb.SearchResponse](t, c.do(http.MethodGet, "/search?q=x&media_type=movie&min_votes=100&sort=rating", nil), http.StatusOK)
	assert.Equal(t, int32(maxScanPages), calls.Load())
	assert.Equal(t, int32(maxScanPages), first.TotalResults)
	assert.Equal(t, int32(1), first.TotalPages)
	for i := 1; i < len(first.Results); i++ {
		assert.GreaterOrEqual(t, first.Results[i-1].VoteAverage, first.Results[i].VoteAverage)
	}
}

func TestDiscoverBothTypesSortsTheMergedList(t *testing.T) {
	c := newClient(t, newTestStore(t), &tmdbtest.Mock{
		DiscoverPageFunc: func(_ context.Context, mediaType string, _ *tmdb.DiscoverFilters, page int) (tmdb.SearchPage, error) {
			base := 5.0
			if mediaType == "tv" {
				base = 6.0
			}
			return tmdb.SearchPage{
				Results: []tmdb.SearchResult{{
					ID: int64(page), MediaType: mediaType, Title: mediaType, VoteAverage: base + float64(page)/10,
				}},
				Page: page, TotalPages: 2, TotalResults: 2,
			}, nil
		},
	})

	got := decode[pb.SearchResponse](t, c.do(http.MethodGet, "/search?sort=rating&min_votes=1", nil), http.StatusOK)
	require.Len(t, got.Results, 4)
	order := make([]float64, 0, len(got.Results))
	for _, r := range got.Results {
		order = append(order, r.VoteAverage)
	}
	assert.Equal(t, []float64{6.2, 6.1, 5.2, 5.1}, order)
}

func TestRelatedSkipsTheShowItself(t *testing.T) {
	st := newTestStore(t)
	id := addTestShow(t, st, 1, store.MediaTV)
	cached := []tmdb.SearchResult{{ID: 1, MediaType: "tv"}, {ID: 2, MediaType: "tv"}}
	c := newClient(t, st, &tmdbtest.Mock{
		FetchRecommendationsFunc: func(context.Context, int64, string) ([]tmdb.SearchResult, error) {
			return cached, nil
		},
	})

	related := decode[pb.GetRelatedResponse](t, c.do(http.MethodGet, showPath(id, "/related"), nil), http.StatusOK)
	require.Len(t, related.Results, 1)
	assert.Equal(t, int64(2), related.Results[0].Id)
	// The client's cached slice is left alone.
	assert.Equal(t, int64(1), cached[0].ID)
	assert.Len(t, cached, 2)
}

func TestRelatedUsesTheCollection(t *testing.T) {
	st := newTestStore(t)
	id, err := st.UpsertShow(t.Context(), &store.Metadata{
		TMDBID: 1, MediaType: store.MediaMovie, Title: "Part One",
		CollectionID: new(int64(77)), CollectionName: new("Saga"),
	}, store.StatusPlanned)
	require.NoError(t, err)
	c := newClient(t, st, &tmdbtest.Mock{
		FetchCollectionFunc: func(_ context.Context, collectionID int64) ([]tmdb.SearchResult, error) {
			require.Equal(t, int64(77), collectionID)
			return []tmdb.SearchResult{{ID: 1, MediaType: "movie"}, {ID: 2, MediaType: "movie"}}, nil
		},
		FetchRecommendationsFunc: func(context.Context, int64, string) ([]tmdb.SearchResult, error) {
			t.Error("a movie in a collection must not ask for recommendations")
			return nil, nil
		},
	})

	related := decode[pb.GetRelatedResponse](t, c.do(http.MethodGet, showPath(id, "/related"), nil), http.StatusOK)
	assert.Equal(t, new("Saga"), related.CollectionName)
	require.Len(t, related.Results, 1)
	assert.Equal(t, int64(2), related.Results[0].Id)
}

func TestRefreshAllStopsAtTheDeadline(t *testing.T) {
	st := newTestStore(t)
	addTestShow(t, st, 1, store.MediaMovie)
	h := newTestHandler(t, st, &tmdbtest.Mock{
		FetchDetailsFunc: func(ctx context.Context, _ int64, _ string) (*tmdb.Detail, error) {
			<-ctx.Done()
			return nil, ctx.Err()
		},
	})
	h.refreshInterval = -time.Hour

	// After the deadline a worker may drop its result instead of sending it,
	// which ends the loop without an error result. Each run takes that path
	// with even odds, so 50 runs make a missed check fail reliably.
	for range 50 {
		ctx, cancel := context.WithTimeout(t.Context(), time.Millisecond)
		rec := httptest.NewRecorder()
		req := httptest.NewRequestWithContext(ctx, http.MethodPost, "/refresh-tmdb", http.NoBody)
		logRequests(Adapt(h.postRefreshTMDBAll)).ServeHTTP(rec, req)
		cancel()

		// Partial counts would claim a finished run, so the deadline is an error.
		body := decode[pb.ErrorResponse](t, rec, http.StatusGatewayTimeout)
		require.Equal(t, "request timed out", body.Error)
	}
}

func TestRefreshTMDBAndExport(t *testing.T) {
	st := newTestStore(t)
	id := addTestShow(t, st, 7, store.MediaTV)
	require.NoError(t, st.UpdateStatus(t.Context(), id, store.StatusWatching))
	require.NoError(t, st.SyncEpisodes(t.Context(), id, []store.EpisodeMetadata{{SeasonNumber: 1, EpisodeNumber: 1}}))
	api := &tmdbtest.Mock{
		FetchDetailsFunc: func(_ context.Context, id int64, mediaType string) (*tmdb.Detail, error) {
			return &tmdb.Detail{
				TMDBID: id, MediaType: mediaType, Title: "Refreshed", NumberOfSeasons: 2,
				Genres: []string{"Action"}, OriginCountry: []string{"US"},
			}, nil
		},
		FetchSeasonFunc: func(_ context.Context, _ int64, season int) (tmdb.Season, error) {
			return tmdb.Season{Episodes: []tmdb.Episode{{SeasonNumber: season, EpisodeNumber: 1}}}, nil
		},
	}
	c := newClient(t, st, api)

	// UpsertShow stamped the row, so nothing is stale within the interval.
	refreshed := decode[pb.RefreshResponse](t, c.do(http.MethodPost, "/refresh-tmdb", nil), http.StatusOK)
	assert.Equal(t, int32(0), refreshed.Updated)

	// A negative interval puts the cutoff in the future, making every row stale.
	c.h.refreshInterval = -time.Hour
	refreshed = decode[pb.RefreshResponse](t, c.do(http.MethodPost, "/refresh-tmdb", nil), http.StatusOK)
	assert.Equal(t, int32(1), refreshed.Updated)
	assert.Equal(t, int32(0), refreshed.Failed)

	show, err := st.GetShow(t.Context(), id)
	require.NoError(t, err)
	assert.Equal(t, "Refreshed", show.Title)
	assert.Equal(t, store.StatusWatching, show.Status)
	// Tracked episodes picked up the new season.
	seasons, err := st.LastSeason(t.Context(), id)
	require.NoError(t, err)
	assert.Equal(t, int64(2), seasons)

	exported := decode[pb.ExportPayload](t, c.do(http.MethodPost, "/export", nil), http.StatusOK)
	require.Len(t, exported.Shows, 1)
	assert.Equal(t, []string{"Action"}, exported.Shows[0].Genres)
}

func TestRefreshTMDBSurvivesFailures(t *testing.T) {
	st := newTestStore(t)
	for _, id := range []int64{1, 2, 3, 4} {
		addTestShow(t, st, id, store.MediaMovie)
	}
	c := newClient(t, st, &tmdbtest.Mock{
		FetchDetailsFunc: func(_ context.Context, id int64, mediaType string) (*tmdb.Detail, error) {
			if id == 3 {
				return nil, errors.New("TMDB says no")
			}
			return &tmdb.Detail{TMDBID: id, MediaType: mediaType, Title: "Refreshed " + strconv.FormatInt(id, 10)}, nil
		},
	})
	c.h.refreshInterval = -time.Hour

	refreshed := decode[pb.RefreshResponse](t, c.do(http.MethodPost, "/refresh-tmdb", nil), http.StatusOK)
	assert.Equal(t, int32(3), refreshed.Updated)
	assert.Equal(t, int32(1), refreshed.Failed)

	shows, _, err := st.ListShows(t.Context(), &store.ListFilters{})
	require.NoError(t, err)
	titles := map[int64]string{}
	for i := range shows {
		titles[shows[i].TMDBID] = shows[i].Title
	}
	assert.Equal(t, map[int64]string{1: "Refreshed 1", 2: "Refreshed 2", 3: "Show 3", 4: "Refreshed 4"}, titles)
}

func TestExportDB(t *testing.T) {
	st := newTestStore(t)
	addTestShow(t, st, 1, store.MediaMovie)
	c := newClient(t, st, nil)

	rec := c.do(http.MethodGet, "/export/db", nil)
	require.Equal(t, http.StatusOK, rec.Code)
	assert.Contains(t, rec.Header().Get("Content-Disposition"), `filename="paired-ratings-`)
	assert.True(t, bytes.HasPrefix(rec.Body.Bytes(), []byte("SQLite format 3\x00")))
}
