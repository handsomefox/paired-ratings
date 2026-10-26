package handlers

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"sync"

	"github.com/handsomefox/paired-ratings/backend/gen/pb"
	"github.com/handsomefox/paired-ratings/backend/logger"
	"github.com/handsomefox/paired-ratings/backend/store"
	"github.com/handsomefox/paired-ratings/backend/tmdb"
)

// seasonConcurrency bounds the parallel TMDB season requests of one sync.
const seasonConcurrency = 4

// tvShow loads the TV show in the URL.
func (h *Handler) tvShow(r *http.Request) (store.Show, error) {
	id, err := idParam(r, "id")
	if err != nil {
		return store.Show{}, err
	}
	show, err := h.store.GetShow(r.Context(), id)
	if err != nil {
		return store.Show{}, storeError(err)
	}
	if show.MediaType != store.MediaTV {
		return store.Show{}, badRequest("episodes are only available for TV shows")
	}
	return show, nil
}

// getShowEpisodes lists the stored episodes. Only a show with none stored yet
// asks TMDB, so the list keeps working while TMDB is down.
func (h *Handler) getShowEpisodes(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()

	show, err := h.tvShow(r)
	if err != nil {
		return err
	}
	count, err := h.store.CountEpisodes(ctx, show.ID)
	if err != nil {
		return err
	}
	if count == 0 {
		detail, err := h.tmdb.FetchDetails(ctx, show.TMDBID, string(store.MediaTV))
		if err != nil {
			return badGateway(err)
		}
		if err := h.syncAllSeasons(ctx, show.ID, show.TMDBID, detail.NumberOfSeasons, false); err != nil {
			return err
		}
	}
	return h.writeEpisodes(ctx, w, show.ID)
}

func (h *Handler) postShowEpisodesSync(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()

	show, err := h.tvShow(r)
	if err != nil {
		return err
	}
	detail, err := h.tmdb.RefreshDetails(ctx, show.TMDBID, string(store.MediaTV))
	if err != nil {
		return badGateway(err)
	}
	if err := h.syncAllSeasons(ctx, show.ID, show.TMDBID, detail.NumberOfSeasons, true); err != nil {
		return err
	}
	return h.writeEpisodes(ctx, w, show.ID)
}

func (h *Handler) writeEpisodes(ctx context.Context, w http.ResponseWriter, showID int64) error {
	episodes, err := h.store.ListEpisodes(ctx, showID)
	if err != nil {
		return err
	}
	seasons, err := h.store.LastSeason(ctx, showID)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, &pb.EpisodesResponse{
		Episodes:     toPBEpisodes(episodes),
		TotalSeasons: clampInt32(seasons),
	})
	return nil
}

func (h *Handler) postEpisodeToggle(w http.ResponseWriter, r *http.Request) error {
	id, err := idParam(r, "id")
	if err != nil {
		return err
	}
	var req pb.ToggleEpisodeRequest
	if err := decodeJSON(r, &req); err != nil {
		return badRequest("bad request")
	}
	if err := h.store.SetEpisodeWatched(r.Context(), id, req.Watched); err != nil {
		return storeError(err)
	}
	w.WriteHeader(http.StatusNoContent)
	return nil
}

func (h *Handler) postSeasonToggle(w http.ResponseWriter, r *http.Request) error {
	id, err := idParam(r, "id")
	if err != nil {
		return err
	}
	season, err := idParam(r, "season")
	if err != nil {
		return err
	}
	var req pb.ToggleEpisodeRequest
	if err := decodeJSON(r, &req); err != nil {
		return badRequest("bad request")
	}
	if err := h.store.SetSeasonWatched(r.Context(), id, season, req.Watched); err != nil {
		return storeError(err)
	}
	w.WriteHeader(http.StatusNoContent)
	return nil
}

// syncAllSeasons stores every season's episodes. The seasons are fetched in
// parallel and written in order. A failed season does not stop the others;
// the error names each one that failed.
func (h *Handler) syncAllSeasons(ctx context.Context, showID, tmdbID int64, totalSeasons int, refresh bool) error {
	fetchSeason := h.tmdb.FetchSeason
	if refresh {
		fetchSeason = h.tmdb.RefreshSeason
	}

	seasons := make([]tmdb.Season, totalSeasons)
	errs := make([]error, totalSeasons)
	var wg sync.WaitGroup
	slots := make(chan struct{}, seasonConcurrency)
	for i := range totalSeasons {
		slots <- struct{}{}
		wg.Go(func() {
			defer func() { <-slots }()
			seasons[i], errs[i] = fetchSeason(ctx, tmdbID, i+1)
		})
	}
	wg.Wait()

	var fetchErr error
	for i := range seasons {
		if errs[i] != nil {
			slog.Warn("episodes: fetch season failed",
				slog.Int("season", i+1),
				logger.Error(errs[i]))
			fetchErr = errors.Join(fetchErr, fmt.Errorf("season %d: %w", i+1, errs[i]))
			continue
		}
		if err := h.store.SyncEpisodes(ctx, showID, episodesFromSeason(&seasons[i])); err != nil {
			return errors.Join(fetchErr, err)
		}
	}
	if fetchErr != nil {
		return badGateway(fetchErr)
	}
	return nil
}
