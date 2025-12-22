package handlers

import (
	"bytes"
	"fmt"
	"io/fs"
	"net/http"
	"path"
	"strings"
	"time"
)

func SPA(distFS fs.FS) (http.Handler, error) {
	indexBytes, err := fs.ReadFile(distFS, "index.html")
	if err != nil {
		return nil, fmt.Errorf("failed to read embedded index.html: %w", err)
	}
	fileServer := http.FileServer(http.FS(distFS))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cleanPath := path.Clean(r.URL.Path)
		if cleanPath == "." {
			cleanPath = "/"
		}
		if cleanPath == "/" {
			serveIndex(w, r, indexBytes)
			return
		}
		trimmed := strings.TrimPrefix(cleanPath, "/")
		if info, err := fs.Stat(distFS, trimmed); err == nil && !info.IsDir() {
			setStaticCacheHeaders(w, trimmed)
			fileServer.ServeHTTP(w, r)
			return
		}
		if strings.Contains(path.Base(cleanPath), ".") {
			setStaticCacheHeaders(w, trimmed)
			fileServer.ServeHTTP(w, r)
			return
		}
		serveIndex(w, r, indexBytes)
	}), nil
}

func serveIndex(w http.ResponseWriter, r *http.Request, index []byte) {
	w.Header().Set("Cache-Control", "no-cache")
	http.ServeContent(w, r, "index.html", time.Time{}, bytes.NewReader(index))
}

func setStaticCacheHeaders(w http.ResponseWriter, filePath string) {
	if strings.HasPrefix(filePath, "assets/") {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		return
	}
	if strings.HasSuffix(filePath, ".html") {
		w.Header().Set("Cache-Control", "no-cache")
		return
	}
	w.Header().Set("Cache-Control", "public, max-age=3600")
}
