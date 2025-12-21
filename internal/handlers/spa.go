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
			fileServer.ServeHTTP(w, r)
			return
		}
		if strings.Contains(path.Base(cleanPath), ".") {
			fileServer.ServeHTTP(w, r)
			return
		}
		serveIndex(w, r, indexBytes)
	}), nil
}

func serveIndex(w http.ResponseWriter, r *http.Request, index []byte) {
	http.ServeContent(w, r, "index.html", time.Time{}, bytes.NewReader(index))
}
