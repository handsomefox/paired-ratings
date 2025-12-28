package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"

	"github.com/go-chi/chi/v5"
	"github.com/handsomefox/paired-ratings/backend/gen/pb"
	"github.com/handsomefox/paired-ratings/backend/store"
	"github.com/handsomefox/paired-ratings/backend/tmdb"
	"github.com/stretchr/testify/require"
)

func newTestHandler(t *testing.T, st *store.Store) *Handler {
	return newTestHandlerWithTMDB(t, st, tmdb.New("", ""))
}

func newTestHandlerWithTMDB(t *testing.T, st *store.Store, client tmdb.Interface) *Handler {
	if client == nil {
		client = tmdb.New("", "")
	}
	cat, err := New(&Config{
		Store:     st,
		TMDB:      client,
		Password:  "secret",
		ImageBase: "https://img.example",
		BfName:    "BF",
		GfName:    "GF",
	})
	require.NoError(t, err)
	return cat
}

func login(t *testing.T, router http.Handler, password string) *http.Cookie {
	payload, err := json.Marshal(&pb.LoginRequest{Password: password})
	require.NoError(t, err)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/login", bytes.NewReader(payload))
	router.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Result().StatusCode)

	cookies := rec.Result().Cookies()
	require.NotEmpty(t, cookies)
	return cookies[0]
}

func TestAdaptErrorResponse(t *testing.T) {
	h := Adapt(func(w http.ResponseWriter, r *http.Request) error {
		return &Error{Status: http.StatusBadRequest, Message: "bad request"}
	})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", http.NoBody)
	h.ServeHTTP(rec, req)

	resp := rec.Result()
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)

	var body pb.ErrorResponse
	require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
	require.Equal(t, "bad request", body.Error)
}

func TestAdaptInternalError(t *testing.T) {
	h := Adapt(func(w http.ResponseWriter, r *http.Request) error {
		return errors.New("boom")
	})

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", http.NoBody)
	h.ServeHTTP(rec, req)

	require.Equal(t, http.StatusInternalServerError, rec.Result().StatusCode)
}

func TestMiddlewareRequireAuth(t *testing.T) {
	st, err := store.Open(t.TempDir() + "/ratings.db")
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, st.Close())
	})

	h := newTestHandler(t, st)
	protected := h.MiddlewareRequireAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/", http.NoBody)
	protected.ServeHTTP(rec, req)
	require.Equal(t, http.StatusUnauthorized, rec.Result().StatusCode)

	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/", http.NoBody)
	req.AddCookie(&http.Cookie{Name: authCookieName, Value: h.passHash})
	protected.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Result().StatusCode)
}

func TestAuthFlowWithStore(t *testing.T) {
	st, err := store.Open(t.TempDir() + "/ratings.db")
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, st.Close())
	})

	ctx := context.Background()
	_, err = st.UpsertShow(ctx, &store.Show{
		TMDBID:    1,
		MediaType: "movie",
		Title:     "Test Movie",
		Status:    "planned",
	})
	require.NoError(t, err)

	h := newTestHandler(t, st)
	r := chi.NewRouter()
	h.RegisterRoutes(r)

	authCookie := login(t, r, "secret")

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/session", http.NoBody)
	req.AddCookie(authCookie)
	r.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Result().StatusCode)

	var session pb.SessionResponse
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&session))
	require.NotNil(t, session.Authenticated)
	require.True(t, *session.Authenticated)

	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/shows/", http.NoBody)
	req.AddCookie(authCookie)
	r.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Result().StatusCode)

	var listResp pb.ListResponse
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&listResp))
	require.Len(t, listResp.Shows, 1)
	require.Equal(t, "Test Movie", listResp.Shows[0].Title)

	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/logout", http.NoBody)
	req.AddCookie(authCookie)
	r.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Result().StatusCode)

	var logoutResp pb.SessionResponse
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&logoutResp))
	require.NotNil(t, logoutResp.Authenticated)
	require.False(t, *logoutResp.Authenticated)
}

func TestShowLifecycleHandlers(t *testing.T) {
	st, err := store.Open(t.TempDir() + "/ratings.db")
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, st.Close())
	})

	ctx := context.Background()
	showID, err := st.UpsertShow(ctx, &store.Show{
		TMDBID:    2,
		MediaType: "movie",
		Title:     "Second Movie",
		Status:    "planned",
	})
	require.NoError(t, err)

	h := newTestHandler(t, st)
	r := chi.NewRouter()
	h.RegisterRoutes(r)

	authCookie := login(t, r, "secret")

	ratingsPayload, err := json.Marshal(&pb.RatingsRequest{BfRating: ptr(int32(7))})
	require.NoError(t, err)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/shows/"+strconv.FormatInt(showID, 10)+"/ratings", bytes.NewReader(ratingsPayload))
	req.AddCookie(authCookie)
	r.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Result().StatusCode)

	var detail pb.ShowDetail
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&detail))
	require.NotNil(t, detail.Show)
	require.NotNil(t, detail.Show.BfRating)
	require.Equal(t, int64(7), *detail.Show.BfRating)
	require.Equal(t, "watched", detail.Show.Status)

	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/shows/"+strconv.FormatInt(showID, 10)+"/toggle-status", http.NoBody)
	req.AddCookie(authCookie)
	r.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Result().StatusCode)

	detail = pb.ShowDetail{}
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&detail))
	require.NotNil(t, detail.Show)
	require.Equal(t, "planned", detail.Show.Status)

	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/shows/"+strconv.FormatInt(showID, 10)+"/clear-ratings", http.NoBody)
	req.AddCookie(authCookie)
	r.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Result().StatusCode)

	detail = pb.ShowDetail{}
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&detail))
	require.NotNil(t, detail.Show)
	require.Nil(t, detail.Show.BfRating)
	require.Nil(t, detail.Show.GfRating)

	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodDelete, "/shows/"+strconv.FormatInt(showID, 10)+"/", http.NoBody)
	req.AddCookie(authCookie)
	r.ServeHTTP(rec, req)
	require.Equal(t, http.StatusNoContent, rec.Result().StatusCode)

	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/shows/"+strconv.FormatInt(showID, 10)+"/", http.NoBody)
	req.AddCookie(authCookie)
	r.ServeHTTP(rec, req)
	require.Equal(t, http.StatusNotFound, rec.Result().StatusCode)
}

func TestSearchEndpointsWithMockTMDB(t *testing.T) {
	st, err := store.Open(t.TempDir() + "/ratings.db")
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, st.Close())
	})

	mock := &tmdb.Mock{
		FetchGenresFunc: func(ctx context.Context, mediaType string) ([]tmdb.Genre, error) {
			if mediaType == "movie" {
				return []tmdb.Genre{{ID: 1, Name: "Action"}}, nil
			}
			return []tmdb.Genre{{ID: 2, Name: "Drama"}}, nil
		},
		FetchCountriesFunc: func(ctx context.Context) ([]tmdb.Country, error) {
			return []tmdb.Country{{Code: "US", Name: "United States"}}, nil
		},
		FetchLanguagesFunc: func(ctx context.Context) ([]tmdb.Language, error) {
			return []tmdb.Language{{Code: "en", Name: "English"}}, nil
		},
		FetchDetailsFunc: func(ctx context.Context, id int64, mediaType string) (*tmdb.Detail, error) {
			return &tmdb.Detail{IMDbID: "tt123", MediaType: mediaType}, nil
		},
		SearchPageFunc: func(ctx context.Context, query string, mediaType string, page int) (tmdb.SearchPage, error) {
			return tmdb.SearchPage{
				Results: []tmdb.SearchResult{{
					ID:               10,
					MediaType:        mediaType,
					Title:            "Test Movie",
					VoteAverage:      7.2,
					VoteCount:        12,
					GenreIDs:         []int{1},
					OriginalLanguage: "en",
				}},
				Page:         1,
				TotalPages:   1,
				TotalResults: 1,
			}, nil
		},
	}

	h := newTestHandlerWithTMDB(t, st, mock)
	r := chi.NewRouter()
	h.RegisterRoutes(r)

	authCookie := login(t, r, "secret")

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/search/genres", http.NoBody)
	req.AddCookie(authCookie)
	r.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Result().StatusCode)

	var genres pb.SearchGenresResponse
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&genres))
	require.Len(t, genres.MovieGenres, 1)
	require.Len(t, genres.TvGenres, 1)

	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/search/countries", http.NoBody)
	req.AddCookie(authCookie)
	r.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Result().StatusCode)

	var countries pb.SearchCountriesResponse
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&countries))
	require.Len(t, countries.Countries, 1)
	require.Equal(t, "US", countries.Countries[0].Code)

	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/search/languages", http.NoBody)
	req.AddCookie(authCookie)
	r.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Result().StatusCode)

	var languages pb.SearchLanguagesResponse
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&languages))
	require.Len(t, languages.Languages, 1)
	require.Equal(t, "en", languages.Languages[0].Code)

	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/search/resolve?tmdb_id=10&media_type=movie", http.NoBody)
	req.AddCookie(authCookie)
	r.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Result().StatusCode)

	var resolve pb.SearchResolveResponse
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&resolve))
	require.NotNil(t, resolve.ImdbUrl)
	require.Contains(t, *resolve.ImdbUrl, "tt123")

	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/search?q=test&media_type=movie", http.NoBody)
	req.AddCookie(authCookie)
	r.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Result().StatusCode)

	var search pb.SearchResponse
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&search))
	require.Len(t, search.Results, 1)
	require.Equal(t, int64(10), search.Results[0].Id)
}

func TestRefreshTMDBAndExportHandlers(t *testing.T) {
	st, err := store.Open(t.TempDir() + "/ratings.db")
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, st.Close())
	})

	ctx := context.Background()
	_, err = st.UpsertShow(ctx, &store.Show{
		TMDBID:    7,
		MediaType: "movie",
		Title:     "Refresh Me",
		Status:    "planned",
	})
	require.NoError(t, err)

	mock := &tmdb.Mock{
		FetchDetailsFunc: func(ctx context.Context, id int64, mediaType string) (*tmdb.Detail, error) {
			return &tmdb.Detail{
				TMDBID:        id,
				MediaType:     mediaType,
				Title:         "Refresh Me",
				IMDbID:        "tt999",
				VoteAverage:   8.1,
				VoteCount:     44,
				Genres:        []string{"Action"},
				OriginCountry: []string{"US"},
			}, nil
		},
	}

	h := newTestHandlerWithTMDB(t, st, mock)
	r := chi.NewRouter()
	h.RegisterRoutes(r)

	authCookie := login(t, r, "secret")

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/refresh-tmdb", http.NoBody)
	req.AddCookie(authCookie)
	r.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Result().StatusCode)

	var refreshed pb.RefreshResponse
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&refreshed))
	require.Equal(t, int32(1), refreshed.Updated)

	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPost, "/export", http.NoBody)
	req.AddCookie(authCookie)
	r.ServeHTTP(rec, req)
	require.Equal(t, http.StatusOK, rec.Result().StatusCode)

	var exported pb.ExportPayload
	require.NoError(t, json.NewDecoder(rec.Body).Decode(&exported))
	require.Len(t, exported.Shows, 1)
	require.Equal(t, "Refresh Me", exported.Shows[0].Title)
}
