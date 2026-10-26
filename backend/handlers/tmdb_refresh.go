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

	stale, err := h.store.ListStaleShows(ctx, time.Now().Add(-h.refreshInterval))
	if err != nil {
		return err
	}

	var updated, failed int
	for result := range h.fetchDetails(ctx, stale) {
		err := result.err
		if err == nil {
			err = h.applyRefresh(ctx, result.show.ShowID, result.detail, result.show.HasEpisodes)
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
	// The workers stop early when the deadline passes, which ends the loop
	// without an error result. Partial counts would then read as a full run.
	if err := ctx.Err(); err != nil {
		return err
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
