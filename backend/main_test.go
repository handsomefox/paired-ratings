package main

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/handsomefox/paired-ratings/backend/handlers"
	"github.com/handsomefox/paired-ratings/backend/store"
	"github.com/handsomefox/paired-ratings/backend/tmdb/tmdbtest"
)

func TestRouterRejectsCrossSiteWrites(t *testing.T) {
	st, err := store.Open(t.Context(), filepath.Join(t.TempDir(), "ratings.db"))
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, st.Close()) })
	app, err := handlers.New(&handlers.Config{
		Store:      st,
		TMDB:       &tmdbtest.Mock{},
		Password:   "secret",
		SessionKey: bytes.Repeat([]byte{1}, 32),
		BfName:     "BF",
		GfName:     "GF",
	})
	require.NoError(t, err)
	router, err := newRouter(app, &appConfig{Port: "8080", DisableStaticContent: true})
	require.NoError(t, err)

	logout := func(fetchSite string) *httptest.ResponseRecorder {
		req := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/api/logout", http.NoBody)
		req.Header.Set("Sec-Fetch-Site", fetchSite)
		rec := httptest.NewRecorder()
		router.ServeHTTP(rec, req)
		return rec
	}
	rejected := logout("cross-site")
	assert.Equal(t, http.StatusForbidden, rejected.Code)
	assert.JSONEq(t, `{"error":"cross-origin request rejected"}`, rejected.Body.String())
	assert.Equal(t, http.StatusOK, logout("same-origin").Code)
}
