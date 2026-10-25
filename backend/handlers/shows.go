package handlers

import (
	"context"
	"log/slog"
	"net/http"
	"slices"
	"strconv"
	"strings"

	"github.com/handsomefox/paired-ratings/backend/gen/pb"
	"github.com/handsomefox/paired-ratings/backend/logger"
	"github.com/handsomefox/paired-ratings/backend/store"
	"github.com/handsomefox/paired-ratings/backend/tmdb"
)

func (h *Handler) getShows(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()

	filters, err := parseListFilters(r)
	if err != nil {
		return err
	}
	shows, total, err := h.store.ListShows(ctx, filters)
	if err != nil {
		return err
	}
	genres, err := h.store.ListGenres(ctx)
	if err != nil {
		return err
	}
	countries, err := h.store.ListCountries(ctx)
	if err != nil {
		return err
	}

	// Library cards show episode progress for TV shows.
	var tvIDs []int64
	for i := range shows {
		if shows[i].MediaType == store.MediaTV {
			tvIDs = append(tvIDs, shows[i].ID)
		}
	}
	counts, err := h.store.EpisodeCounts(ctx, tvIDs)
	if err != nil {
		return err
	}

	pbShows := toPBShows(shows)
	for _, show := range pbShows {
		if c, ok := counts[show.Id]; ok {
			show.TotalEpisodes = new(clampInt32(c.Total))
			show.WatchedEpisodes = new(clampInt32(c.Watched))
		}
	}

	writeJSON(w, http.StatusOK, &pb.ListResponse{
		Shows:      pbShows,
		Genres:     genres,
		Countries:  countries,
		TotalCount: clampInt32(total),
	})
	return nil
}

// parseListFilters reads the library query. page_size is 20, 50, 100, or "all".
func parseListFilters(r *http.Request) (*store.ListFilters, error) {
	q := r.URL.Query()
	f := store.ListFilters{
		Genre:    q.Get("genre"),
		Country:  strings.ToUpper(strings.TrimSpace(q.Get("origin_country"))),
		Unrated:  q.Get("unrated") == "1",
		Page:     1,
		PageSize: 20,
	}

	switch status := store.Status(q.Get("status")); {
	case status == "" || status == "all":
	case status.Valid():
		f.Status = status
	default:
		return nil, badRequest("invalid status")
	}

	if sort := store.Sort(q.Get("sort")); sort.Valid() {
		f.Sort = sort
	}

	var err error
	if f.YearFrom, err = optionalInt(q.Get("year_from")); err != nil {
		return nil, badRequest("invalid year_from")
	}
	if f.YearTo, err = optionalInt(q.Get("year_to")); err != nil {
		return nil, badRequest("invalid year_to")
	}
	if page, err := strconv.Atoi(q.Get("page")); err == nil && page > 1 {
		f.Page = page
	}

	switch q.Get("page_size") {
	case "50":
		f.PageSize = 50
	case "100":
		f.PageSize = 100
	case "all":
		f.PageSize = 0
	}
	return &f, nil
}

func optionalInt(s string) (*int64, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil, nil //nolint:nilnil // An empty parameter means no filter.
	}
	v, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return nil, err
	}
	return &v, nil
}

func (h *Handler) postShows(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()

	var req pb.AddShowRequest
	if err := decodeJSON(r, &req); err != nil {
		return badRequest("bad request")
	}
	if req.TmdbId <= 0 {
		return badRequest("tmdb_id required")
	}
	mediaType := store.MediaType(strings.TrimSpace(req.MediaType))
	if !mediaType.Valid() {
		return badRequest("invalid media_type")
	}
	status := store.Status(strings.TrimSpace(req.Status))
	if status == "" {
		status = store.StatusPlanned
	}
	if !status.Valid() {
		return badRequest("invalid status")
	}

	detail, err := h.tmdb.FetchDetails(ctx, req.TmdbId, string(mediaType))
	if err != nil {
		return badGateway(err)
	}
	// A show already in the library keeps its status and ratings.
	id, err := h.store.UpsertShow(ctx, metadataFromDetail(detail), status)
	if err != nil {
		return err
	}
	return h.writeShow(ctx, w, id)
}

// writeShow responds with the stored show.
func (h *Handler) writeShow(ctx context.Context, w http.ResponseWriter, id int64) error {
	show, err := h.store.GetShow(ctx, id)
	if err != nil {
		return storeError(err)
	}
	writeJSON(w, http.StatusOK, toPBShowDetail(&show))
	return nil
}

// updateShow runs update on the show in the URL and responds with the result.
func (h *Handler) updateShow(w http.ResponseWriter, r *http.Request, update func(ctx context.Context, id int64) error) error {
	id, err := idParam(r, "id")
	if err != nil {
		return err
	}
	if err := update(r.Context(), id); err != nil {
		return storeError(err)
	}
	return h.writeShow(r.Context(), w, id)
}

func (h *Handler) getShow(w http.ResponseWriter, r *http.Request) error {
	id, err := idParam(r, "id")
	if err != nil {
		return err
	}
	return h.writeShow(r.Context(), w, id)
}

func (h *Handler) deleteShow(w http.ResponseWriter, r *http.Request) error {
	id, err := idParam(r, "id")
	if err != nil {
		return err
	}
	if err := h.store.DeleteShow(r.Context(), id); err != nil {
		return storeError(err)
	}
	w.WriteHeader(http.StatusNoContent)
	return nil
}

func (h *Handler) postShowRatings(w http.ResponseWriter, r *http.Request) error {
	var req pb.RatingsRequest
	if err := decodeJSON(r, &req); err != nil {
		return badRequest("bad request")
	}

	var update store.RatingsUpdate
	for _, rating := range []struct {
		value  *int32
		change *store.Change[int64]
	}{{req.BfRating, &update.BfRating}, {req.GfRating, &update.GfRating}} {
		if rating.value == nil {
			continue
		}
		if *rating.value < 1 || *rating.value > 10 {
			return badRequest("ratings go from 1 to 10")
		}
		*rating.change = store.Change[int64]{Set: true, Value: new(int64(*rating.value))}
	}
	// An empty comment clears it.
	if req.BfComment != nil {
		update.BfComment = store.Change[string]{Set: true, Value: optional(*req.BfComment)}
	}
	if req.GfComment != nil {
		update.GfComment = store.Change[string]{Set: true, Value: optional(*req.GfComment)}
	}
	if update == (store.RatingsUpdate{}) {
		return badRequest("no ratings or comments given")
	}

	return h.updateShow(w, r, func(ctx context.Context, id int64) error {
		return h.store.UpdateRatings(ctx, id, &update)
	})
}

func (h *Handler) postShowClearRatings(w http.ResponseWriter, r *http.Request) error {
	return h.updateShow(w, r, h.store.ClearRatings)
}

func (h *Handler) postShowSetStatus(w http.ResponseWriter, r *http.Request) error {
	var req pb.SetStatusRequest
	if err := decodeJSON(r, &req); err != nil {
		return badRequest("bad request")
	}
	status := store.Status(strings.TrimSpace(req.Status))
	if !status.Valid() {
		return badRequest("invalid status: must be planned, watching, or watched")
	}
	return h.updateShow(w, r, func(ctx context.Context, id int64) error {
		return h.store.UpdateStatus(ctx, id, status)
	})
}

func (h *Handler) postShowsReorder(w http.ResponseWriter, r *http.Request) error {
	var req pb.ReorderRequest
	if err := decodeJSON(r, &req); err != nil {
		return badRequest("bad request")
	}
	if len(req.OrderedIds) == 0 {
		return badRequest("ordered_ids is required")
	}
	if err := h.store.SetWatchOrder(r.Context(), req.OrderedIds); err != nil {
		return storeError(err)
	}
	w.WriteHeader(http.StatusNoContent)
	return nil
}

func (h *Handler) postShowAddToWatchOrder(w http.ResponseWriter, r *http.Request) error {
	return h.updateShow(w, r, h.store.AddToWatchOrder)
}

func (h *Handler) deleteShowFromWatchOrder(w http.ResponseWriter, r *http.Request) error {
	return h.updateShow(w, r, h.store.RemoveFromWatchOrder)
}

func (h *Handler) postShowRefreshTMDB(w http.ResponseWriter, r *http.Request) error {
	return h.updateShow(w, r, func(ctx context.Context, id int64) error {
		show, err := h.store.GetShow(ctx, id)
		if err != nil {
			return err
		}
		return h.refreshShow(ctx, show.ID, show.TMDBRef(), show.MediaType == store.MediaTV)
	})
}

// refreshShow pulls the show's TMDB metadata again, and its episodes when
// syncEpisodes is set.
func (h *Handler) refreshShow(ctx context.Context, id int64, ref store.TMDBRef, syncEpisodes bool) error {
	detail, err := h.tmdb.RefreshDetails(ctx, ref.ID, string(ref.MediaType))
	if err != nil {
		return badGateway(err)
	}
	if err := h.store.RefreshShow(ctx, metadataFromDetail(detail)); err != nil {
		return err
	}
	if syncEpisodes && detail.NumberOfSeasons > 0 {
		return h.syncAllSeasons(ctx, id, ref.ID, detail.NumberOfSeasons, true)
	}
	return nil
}

func (h *Handler) getShowRelated(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()

	id, err := idParam(r, "id")
	if err != nil {
		return err
	}
	show, err := h.store.GetShow(ctx, id)
	if err != nil {
		return storeError(err)
	}

	var related []tmdb.SearchResult
	var collectionName *string
	if show.MediaType == store.MediaMovie && show.CollectionID != nil {
		collectionName = show.CollectionName
		related, err = h.tmdb.FetchCollection(ctx, *show.CollectionID)
	} else {
		related, err = h.tmdb.FetchRecommendations(ctx, show.TMDBID, string(show.MediaType))
	}
	// A missing related list is not worth failing the page over.
	if err != nil {
		slog.Warn("related: fetch failed", logger.Error(err))
		related = nil
	}

	// Clone first: the client's cache shares the slice.
	related = slices.DeleteFunc(slices.Clone(related), func(item tmdb.SearchResult) bool {
		return item.ID == show.TMDBID && item.MediaType == string(show.MediaType)
	})
	results, err := h.toPBSearchResults(ctx, related)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, &pb.GetRelatedResponse{
		Results:        results,
		CollectionName: collectionName,
	})
	return nil
}
