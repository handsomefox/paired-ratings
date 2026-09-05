package handlers

import (
	"context"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/handsomefox/paired-ratings/backend/gen/pb"
	"github.com/handsomefox/paired-ratings/backend/logger"
	"github.com/handsomefox/paired-ratings/backend/store"
	"github.com/handsomefox/paired-ratings/backend/tmdb"
)

const (
	// defaultRefreshInterval is how long TMDB metadata counts as current. A
	// show refreshed more recently than this is skipped.
	defaultRefreshInterval = 24 * time.Hour

	// refreshConcurrency bounds the parallel TMDB requests. The fetches run in
	// parallel and the writes run on this goroutine, because SQLite takes one
	// writer at a time.
	refreshConcurrency = 4
)

type refreshResult struct {
	item   store.TMDBRefresh
	detail *tmdb.Detail
	err    error
}

func (h *Handler) postRefreshTMDBAll(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()

	cutoff := time.Now().UTC().Add(-h.refreshInterval).Format(time.RFC3339)
	items, err := h.store.ListTMDBStale(ctx, cutoff)
	if err != nil {
		return internal(err)
	}

	var updated, failed int
	for result := range h.fetchDetails(ctx, items) {
		if result.err != nil {
			// One bad title must not abandon the rest of the library.
			failed++
			slog.Warn("refresh: fetch failed",
				slog.Int64("tmdb_id", result.item.TMDBID),
				slog.String("media_type", result.item.MediaType),
				logger.Error(result.err))
			continue
		}

		show := showFromDetail(result.detail, result.item.Status)
		if _, err := h.store.UpsertShow(ctx, &show); err != nil {
			if ctx.Err() != nil {
				return internal(err)
			}
			failed++
			slog.Warn("refresh: upsert failed",
				slog.Int64("tmdb_id", result.item.TMDBID),
				logger.Error(err))
			continue
		}
		updated++
	}

	slog.Info("refresh: finished",
		slog.Int("updated", updated),
		slog.Int("failed", failed),
		slog.Int("stale", len(items)))

	writeJSON(w, http.StatusOK, &pb.RefreshResponse{
		Updated: clampInt32(updated),
		Failed:  clampInt32(failed),
	})
	return nil
}

// fetchDetails runs the TMDB requests with bounded parallelism and yields each
// result as it lands. Writes stay on the caller's goroutine.
func (h *Handler) fetchDetails(ctx context.Context, items []store.TMDBRefresh) <-chan refreshResult {
	out := make(chan refreshResult)

	go func() {
		defer close(out)

		var wg sync.WaitGroup
		slots := make(chan struct{}, refreshConcurrency)

		for _, item := range items {
			if ctx.Err() != nil {
				break
			}
			slots <- struct{}{}
			wg.Go(func() {
				defer func() { <-slots }()
				detail, err := h.tmdb.RefreshDetails(ctx, item.TMDBID, item.MediaType)
				out <- refreshResult{item: item, detail: detail, err: err}
			})
		}

		wg.Wait()
	}()

	return out
}
