package handlers

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/handsomefox/paired-ratings/backend/gen/pb"
	"github.com/handsomefox/paired-ratings/backend/logger"
	"github.com/handsomefox/paired-ratings/backend/store"
)

func (h *Handler) getExportDB(w http.ResponseWriter, r *http.Request) error {
	dbPath := h.store.DBPath()
	if dbPath == "" {
		return internal(errors.New("db path not available"))
	}

	f, err := os.Open(dbPath)
	if err != nil {
		slog.Warn("export db: open failed", logger.Error(err))
		return internal(err)
	}
	defer func() { _ = f.Close() }()

	fi, err := f.Stat()
	if err != nil {
		return internal(err)
	}

	date := time.Now().UTC().Format("2006-01-02")
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="paired-ratings-%s.db"`, date))
	http.ServeContent(w, r, "paired-ratings.db", fi.ModTime(), f)
	return nil
}

func (h *Handler) postExport(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()

	shows, _, err := h.store.ListShows(ctx, &store.ListFilters{Status: "all"})
	if err != nil {
		return internal(err)
	}

	payload := &pb.ExportPayload{
		ExportedAt: time.Now().UTC().Format(time.RFC3339),
		Shows:      make([]*pb.Show, 0, len(shows)),
	}
	for i := range shows {
		payload.Shows = append(payload.Shows, toPBShow(&shows[i]))
	}

	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetIndent("", "  ")
	if err := enc.Encode(payload); err != nil {
		return internal(err)
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Content-Disposition", "attachment; filename=show-ratings.json")
	if _, err := w.Write(buf.Bytes()); err != nil {
		slog.Warn("export write failed", logger.Error(err))
	}
	return nil
}
