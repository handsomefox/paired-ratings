package handlers

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/handsomefox/paired-ratings/backend/gen/pb"
	"github.com/handsomefox/paired-ratings/backend/logger"
	"github.com/handsomefox/paired-ratings/backend/store"
)

func (h *Handler) postExport(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()

	shows, err := h.store.ListShows(ctx, store.ListFilters{Status: "all"})
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
