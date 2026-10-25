package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/handsomefox/paired-ratings/backend/gen/pb"
	"github.com/handsomefox/paired-ratings/backend/logger"
	"github.com/handsomefox/paired-ratings/backend/store"
)

func (h *Handler) getExportDB(w http.ResponseWriter, r *http.Request) error {
	dir, err := os.MkdirTemp("", "paired-ratings-export-")
	if err != nil {
		return err
	}
	defer func() {
		if err := os.RemoveAll(dir); err != nil {
			slog.Warn("export db: cleanup failed", logger.Error(err))
		}
	}()

	dbPath := filepath.Join(dir, "ratings.db")
	if err := h.store.Backup(r.Context(), dbPath); err != nil {
		return err
	}
	f, err := os.Open(dbPath) //nolint:gosec // Path is inside a private, server-created temporary directory.
	if err != nil {
		return err
	}
	defer func() {
		if err := f.Close(); err != nil {
			slog.Warn("export db: close failed", logger.Error(err))
		}
	}()

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", attachment("paired-ratings-%s.db"))
	w.Header().Set("Cache-Control", "no-store")
	_, err = io.Copy(w, f)
	return err
}

func (h *Handler) postExport(w http.ResponseWriter, r *http.Request) error {
	shows, _, err := h.store.ListShows(r.Context(), &store.ListFilters{})
	if err != nil {
		return err
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Content-Disposition", attachment("paired-ratings-%s.json"))
	w.Header().Set("Cache-Control", "no-store")
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	return enc.Encode(&pb.ExportPayload{
		ExportedAt: time.Now().UTC().Format(time.RFC3339),
		Shows:      toPBShows(shows),
	})
}

// attachment names a download after today's date.
func attachment(nameFormat string) string {
	return fmt.Sprintf(`attachment; filename="`+nameFormat+`"`, time.Now().UTC().Format(time.DateOnly))
}
