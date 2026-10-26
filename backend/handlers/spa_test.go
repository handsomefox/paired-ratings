package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"testing/fstest"

	"github.com/stretchr/testify/require"
)

func TestSPACompression(t *testing.T) {
	dist := fstest.MapFS{
		"index.html":     {Data: []byte("plain")},
		"index.html.gz":  {Data: []byte("gzip")},
		"index.html.zst": {Data: []byte("zstd")},
	}
	handler, err := SPA(dist)
	require.NoError(t, err)
	for _, tc := range []struct {
		header, encoding, body string
	}{
		{"", "", "plain"},
		{"gzip;q=0.8", "gzip", "gzip"},
		{"gzip;q=0", "", "plain"},
		{"gzip;q=0.9, zstd;q=0.1", "gzip", "gzip"},
		{"gzip, zstd", "zstd", "zstd"},
		{"GZIP; Q=0.5", "gzip", "gzip"},
		{"gzip-extra", "", "plain"},
		{"*;q=0.5, zstd;q=0", "gzip", "gzip"},
		{"gzip;q=bogus", "", "plain"},
		{"gzip;q=NaN", "", "plain"},
		{"gzip;q=2", "", "plain"},
	} {
		t.Run(tc.header, func(t *testing.T) {
			req := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/library", http.NoBody)
			req.Header.Set("Accept-Encoding", tc.header)
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)
			require.Equal(t, http.StatusOK, rec.Code)
			require.Equal(t, tc.encoding, rec.Header().Get("Content-Encoding"))
			require.Contains(t, rec.Header().Values("Vary"), "Accept-Encoding")
			require.Equal(t, "no-cache", rec.Header().Get("Cache-Control"))
			require.Equal(t, tc.body, rec.Body.String())
		})
	}
}

func TestSPARouting(t *testing.T) {
	dist := fstest.MapFS{
		"index.html":         {Data: []byte("index")},
		"assets/app-1a2b.js": {Data: []byte("app")},
		"icons/logo.png":     {Data: []byte("png")},
	}
	handler, err := SPA(dist)
	require.NoError(t, err)

	for _, tc := range []struct {
		path, body, cacheControl string
		status                   int
	}{
		{"/", "index", "no-cache", http.StatusOK},
		// A client-side route gets the app.
		{"/show/12", "index", "no-cache", http.StatusOK},
		// Vite's hashed output never changes under one name.
		{"/assets/app-1a2b.js", "app", "public, max-age=31536000, immutable", http.StatusOK},
		{"/icons/logo.png", "png", "public, max-age=3600", http.StatusOK},
		// A missing file is a 404, not the app.
		{"/assets/gone.js", "", "", http.StatusNotFound},
	} {
		t.Run(tc.path, func(t *testing.T) {
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, httptest.NewRequestWithContext(t.Context(), http.MethodGet, tc.path, http.NoBody))
			require.Equal(t, tc.status, rec.Code)
			if tc.status == http.StatusOK {
				require.Equal(t, tc.body, rec.Body.String())
				require.Equal(t, tc.cacheControl, rec.Header().Get("Cache-Control"))
			}
		})
	}
}
