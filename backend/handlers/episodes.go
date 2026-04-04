package handlers

import (
	"context"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/handsomefox/paired-ratings/backend/gen/pb"
	"github.com/handsomefox/paired-ratings/backend/logger"
	"github.com/handsomefox/paired-ratings/backend/store"
)

func (h *Handler) getShowEpisodes(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()

	id, err := idParam(r, "id")
	if err != nil {
		return notFound("not found")
	}

	show, err := h.store.GetShow(ctx, id)
	if err != nil {
		if isNoRows(err) {
			return notFound("not found")
		}
		return internal(err)
	}

	if show.MediaType != "tv" {
		return badRequest("episodes are only available for TV shows")
	}

	// Check if we have episodes already; if not, fetch from TMDB.
	count, err := h.store.EpisodeCountForShow(ctx, id)
	if err != nil {
		return internal(err)
	}

	detail, err := h.tmdb.FetchDetails(ctx, show.TMDBID, "tv")
	if err != nil {
		slog.Warn("episodes: fetch details failed", logger.Error(err))
		return &Error{Status: http.StatusBadGateway, Message: err.Error()}
	}

	totalSeasons := detail.NumberOfSeasons

	if count == 0 && totalSeasons > 0 {
		if err := h.syncAllSeasons(ctx, id, show.TMDBID, totalSeasons); err != nil {
			slog.Warn("episodes: initial sync failed", logger.Error(err))
			return internal(err)
		}
	}

	episodes, err := h.store.GetEpisodes(ctx, id)
	if err != nil {
		return internal(err)
	}

	writeJSON(w, http.StatusOK, &pb.EpisodesResponse{
		Episodes:     toPBEpisodes(episodes),
		TotalSeasons: int32(totalSeasons),
	})
	return nil
}

func (h *Handler) postShowEpisodesSync(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()

	id, err := idParam(r, "id")
	if err != nil {
		return notFound("not found")
	}

	show, err := h.store.GetShow(ctx, id)
	if err != nil {
		if isNoRows(err) {
			return notFound("not found")
		}
		return internal(err)
	}

	if show.MediaType != "tv" {
		return badRequest("episodes are only available for TV shows")
	}

	detail, err := h.tmdb.FetchDetails(ctx, show.TMDBID, "tv")
	if err != nil {
		slog.Warn("episodes: fetch details failed", logger.Error(err))
		return &Error{Status: http.StatusBadGateway, Message: err.Error()}
	}

	totalSeasons := detail.NumberOfSeasons

	if totalSeasons > 0 {
		if err := h.syncAllSeasons(ctx, id, show.TMDBID, totalSeasons); err != nil {
			slog.Warn("episodes: sync failed", logger.Error(err))
			return internal(err)
		}
	}

	episodes, err := h.store.GetEpisodes(ctx, id)
	if err != nil {
		return internal(err)
	}

	writeJSON(w, http.StatusOK, &pb.EpisodesResponse{
		Episodes:     toPBEpisodes(episodes),
		TotalSeasons: int32(totalSeasons),
	})
	return nil
}

func (h *Handler) postEpisodeToggle(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()

	id, err := idParam(r, "id")
	if err != nil {
		return notFound("not found")
	}

	var req pb.ToggleEpisodeRequest
	if err := decodeJSON(r, &req); err != nil {
		return badRequest("bad request")
	}

	if err := h.store.ToggleEpisode(ctx, id, req.Watched); err != nil {
		if isNoRows(err) {
			return notFound("not found")
		}
		return internal(err)
	}

	w.WriteHeader(http.StatusNoContent)
	return nil
}

func (h *Handler) postSeasonToggle(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()

	id, err := idParam(r, "id")
	if err != nil {
		return notFound("not found")
	}

	seasonStr := chi.URLParam(r, "season")
	season, err := strconv.Atoi(seasonStr)
	if err != nil || season < 1 {
		return badRequest("invalid season number")
	}

	var req pb.ToggleEpisodeRequest
	if err := decodeJSON(r, &req); err != nil {
		return badRequest("bad request")
	}

	if err := h.store.ToggleSeason(ctx, id, season, req.Watched); err != nil {
		if isNoRows(err) {
			return notFound("not found")
		}
		return internal(err)
	}

	w.WriteHeader(http.StatusNoContent)
	return nil
}

func (h *Handler) syncAllSeasons(ctx context.Context, showID, tmdbID int64, totalSeasons int) error {
	for s := 1; s <= totalSeasons; s++ {
		season, err := h.tmdb.FetchSeason(ctx, tmdbID, s)
		if err != nil {
			slog.Warn("episodes: fetch season failed",
				slog.Int("season", s),
				logger.Error(err),
			)
			continue
		}

		episodes := make([]store.Episode, 0, len(season.Episodes))
		for _, ep := range season.Episodes {
			episodes = append(episodes, store.Episode{
				ShowID:        showID,
				SeasonNumber:  ep.SeasonNumber,
				EpisodeNumber: ep.EpisodeNumber,
				Title:         ep.Title,
				Overview:      ep.Overview,
				AirDate:       ep.AirDate,
				Runtime:       ep.Runtime,
			})
		}

		if err := h.store.SyncEpisodes(ctx, showID, episodes); err != nil {
			return err
		}
	}
	return nil
}

func toPBEpisodes(episodes []store.Episode) []*pb.Episode {
	out := make([]*pb.Episode, 0, len(episodes))
	for _, ep := range episodes {
		pbEp := &pb.Episode{
			Id:            ep.ID,
			SeasonNumber:  int32(ep.SeasonNumber),
			EpisodeNumber: int32(ep.EpisodeNumber),
			Watched:       ep.Watched,
		}
		if ep.Title != "" {
			pbEp.Title = &ep.Title
		}
		if ep.AirDate != "" {
			pbEp.AirDate = &ep.AirDate
		}
		if ep.Runtime > 0 {
			runtime := int32(ep.Runtime)
			pbEp.Runtime = &runtime
		}
		out = append(out, pbEp)
	}
	return out
}
