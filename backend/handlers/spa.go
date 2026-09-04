package handlers

import (
	"bytes"
	"fmt"
	"io"
	"io/fs"
	"log/slog"
	"mime"
	"net/http"
	"path"
	"strconv"
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
	w.Header().Add("Vary", "Accept-Encoding")
	encoding, compressedPath := selectPrecompressed(r.Header.Get("Accept-Encoding"), distFS, originalPath)
	if encoding == "" {
		return false
	}
	file, err := distFS.Open(compressedPath)
	if err != nil {
		return false
	}
	defer func() {
		if err := file.Close(); err != nil {
			slog.Warn("close static asset failed", slog.Any("error", err))
		}
	}()

	info, err := fs.Stat(distFS, compressedPath)
	if err != nil {
		return false
	}

	if contentType := mime.TypeByExtension(path.Ext(originalPath)); contentType != "" {
		w.Header().Set("Content-Type", contentType)
	}
	if reader, ok := file.(io.ReadSeeker); ok {
		w.Header().Set("Content-Encoding", encoding)
		http.ServeContent(w, r, path.Base(originalPath), info.ModTime(), reader)
		return true
	}

	data, err := io.ReadAll(file)
	if err != nil {
		return false
	}
	w.Header().Set("Content-Encoding", encoding)
	http.ServeContent(w, r, path.Base(originalPath), info.ModTime(), bytes.NewReader(data))
	return true
}

func selectPrecompressed(acceptEncoding string, distFS fs.FS, originalPath string) (encoding, filePath string) {
	var selected, selectedPath string
	var bestQuality float64
	for _, candidate := range []struct{ encoding, suffix string }{{"zstd", ".zst"}, {"gzip", ".gz"}} {
		quality := encodingQuality(acceptEncoding, candidate.encoding)
		if quality > bestQuality && exists(distFS, originalPath+candidate.suffix) {
			selected, selectedPath = candidate.encoding, originalPath+candidate.suffix
			bestQuality = quality
		}
	}
	return selected, selectedPath
}

func encodingQuality(acceptEncoding, encoding string) float64 {
	var wildcard float64
	for part := range strings.SplitSeq(acceptEncoding, ",") {
		name, params, _ := strings.Cut(part, ";")
		name = strings.TrimSpace(name)
		if !strings.EqualFold(name, encoding) && name != "*" {
			continue
		}
		quality := 1.0
		for param := range strings.SplitSeq(params, ";") {
			key, value, ok := strings.Cut(strings.TrimSpace(param), "=")
			if ok && strings.EqualFold(strings.TrimSpace(key), "q") {
				q, err := strconv.ParseFloat(strings.TrimSpace(value), 64)
				if err != nil || !(q >= 0 && q <= 1) {
					quality = 0
				} else {
					quality = q
				}
			}
		}
		if name != "*" {
			return quality
		}
		wildcard = quality
	}
	return wildcard
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
