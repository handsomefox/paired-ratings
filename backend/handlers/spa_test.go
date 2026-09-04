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
