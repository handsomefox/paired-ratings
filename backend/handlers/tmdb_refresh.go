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
	// parallel and the writes run on the request goroutine, because SQLite
	// takes one writer at a time.
	refreshConcurrency = 4
)

type refreshResult struct {
	detail *tmdb.Detail
	err    error
	show   store.StaleShow
}

// postRefreshTMDBAll refreshes every stale show, and the episodes of each TV
// show whose episodes are tracked.
func (h *Handler) postRefreshTMDBAll(w http.ResponseWriter, r *http.Request) error {
	// Cancelling on return stops the fetch workers whichever way this ends.
	ctx, cancel := context.WithCancel(r.Context())
	defer cancel()

	cutoff := time.Now().UTC().Add(-h.refreshInterval).Format(time.RFC3339)
	stale, err := h.store.ListStaleShows(ctx, cutoff)
	if err != nil {
		return err
	}

	var updated, failed int
	for result := range h.fetchDetails(ctx, stale) {
		err := result.err
		if err == nil {
			err = h.saveRefresh(ctx, &result)
		}
		if err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			// One bad title must not abandon the rest of the library.
			failed++
			slog.Warn("refresh: show failed",
				slog.Int64("tmdb_id", result.show.Ref.ID),
				slog.String("media_type", string(result.show.Ref.MediaType)),
				logger.Error(err))
			continue
		}
		updated++
	}

	slog.Info("refresh: finished",
		slog.Int("updated", updated),
		slog.Int("failed", failed),
		slog.Int("stale", len(stale)))

	writeJSON(w, http.StatusOK, &pb.RefreshResponse{
		Updated: clampInt32(updated),
		Failed:  clampInt32(failed),
	})
	return nil
}

func (h *Handler) saveRefresh(ctx context.Context, result *refreshResult) error {
	if err := h.store.RefreshShow(ctx, metadataFromDetail(result.detail)); err != nil {
		return err
	}
	if result.show.HasEpisodes && result.detail.NumberOfSeasons > 0 {
		return h.syncAllSeasons(ctx, result.show.ShowID, result.show.Ref.ID, result.detail.NumberOfSeasons, true)
	}
	return nil
}

// fetchDetails runs the TMDB requests with bounded parallelism and yields each
// result as it lands. Once ctx ends, the workers stop, so a caller that stops
// reading early leaves no goroutine behind.
func (h *Handler) fetchDetails(ctx context.Context, shows []store.StaleShow) <-chan refreshResult {
	out := make(chan refreshResult)

	go func() {
		defer close(out)

		var wg sync.WaitGroup
		slots := make(chan struct{}, refreshConcurrency)
		defer wg.Wait()

		for _, show := range shows {
			select {
			case slots <- struct{}{}:
			case <-ctx.Done():
				return
			}
			wg.Go(func() {
				defer func() { <-slots }()
				detail, err := h.tmdb.RefreshDetails(ctx, show.Ref.ID, string(show.Ref.MediaType))
				select {
				case out <- refreshResult{show: show, detail: detail, err: err}:
				case <-ctx.Done():
				}
			})
		}
	}()

	return out
}
