package handlers

import (
	"bytes"
	"fmt"
	"io"
	"io/fs"
	"mime"
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
			serveIndex(w, r, distFS, indexBytes)
			return
		}
		trimmed := strings.TrimPrefix(cleanPath, "/")
		if info, err := fs.Stat(distFS, trimmed); err == nil && !info.IsDir() {
			setStaticCacheHeaders(w, trimmed)
			if servePrecompressed(w, r, distFS, trimmed) {
				return
			}
			fileServer.ServeHTTP(w, r)
			return
		}
		if strings.Contains(path.Base(cleanPath), ".") {
			setStaticCacheHeaders(w, trimmed)
			if servePrecompressed(w, r, distFS, trimmed) {
				return
			}
			fileServer.ServeHTTP(w, r)
			return
		}
		serveIndex(w, r, distFS, indexBytes)
	}), nil
}

func serveIndex(w http.ResponseWriter, r *http.Request, distFS fs.FS, index []byte) {
	w.Header().Set("Cache-Control", "no-cache")
	if servePrecompressed(w, r, distFS, "index.html") {
		return
	}
	http.ServeContent(w, r, "index.html", time.Time{}, bytes.NewReader(index))
}

func servePrecompressed(w http.ResponseWriter, r *http.Request, distFS fs.FS, originalPath string) bool {
	encoding, compressedPath := selectPrecompressed(r.Header.Get("Accept-Encoding"), distFS, originalPath)
	if encoding == "" {
		return false
	}
	file, err := distFS.Open(compressedPath)
	if err != nil {
		return false
	}
	defer file.Close()

	info, err := fs.Stat(distFS, compressedPath)
	if err != nil {
		return false
	}

	if contentType := mime.TypeByExtension(path.Ext(originalPath)); contentType != "" {
		w.Header().Set("Content-Type", contentType)
	}
	w.Header().Set("Content-Encoding", encoding)
	w.Header().Add("Vary", "Accept-Encoding")

	if reader, ok := file.(io.ReadSeeker); ok {
		http.ServeContent(w, r, path.Base(originalPath), info.ModTime(), reader)
		return true
	}

	data, err := io.ReadAll(file)
	if err != nil {
		return false
	}
	http.ServeContent(w, r, path.Base(originalPath), info.ModTime(), bytes.NewReader(data))
	return true
}

func selectPrecompressed(acceptEncoding string, distFS fs.FS, originalPath string) (string, string) {
	acceptEncoding = strings.ToLower(acceptEncoding)
	if acceptsEncoding(acceptEncoding, "zstd") {
		candidate := originalPath + ".zst"
		if exists(distFS, candidate) {
			return "zstd", candidate
		}
	}
	if acceptsEncoding(acceptEncoding, "gzip") {
		candidate := originalPath + ".gz"
		if exists(distFS, candidate) {
			return "gzip", candidate
		}
	}
	return "", ""
}

func acceptsEncoding(acceptEncoding, encoding string) bool {
	for _, part := range strings.Split(acceptEncoding, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		if strings.HasPrefix(part, encoding) {
			if strings.Contains(part, "q=0") {
				return false
			}
			return true
		}
	}
	return false
}

func exists(distFS fs.FS, filePath string) bool {
	info, err := fs.Stat(distFS, filePath)
	return err == nil && !info.IsDir()
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
