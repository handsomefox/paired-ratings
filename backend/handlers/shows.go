package handlers

import (
	"database/sql"
	"log/slog"
	"net/http"
	"strconv"
	"strings"

	"github.com/handsomefox/paired-ratings/backend/gen/pb"
	"github.com/handsomefox/paired-ratings/backend/logger"
	"github.com/handsomefox/paired-ratings/backend/store"
	"github.com/handsomefox/paired-ratings/backend/tmdb"
)

func (h *Handler) getShows(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	filters := parseListFilters(r)

	shows, err := h.store.ListShows(ctx, filters)
	if err != nil {
		slog.Warn("list shows failed", logger.Error(err))
		return internal(err)
	}

	genres, err := h.store.ListAllGenres(ctx)
	if err != nil {
		slog.Warn("list genres failed", logger.Error(err))
		return internal(err)
	}

	countries, err := h.store.ListAllCountries(ctx)
	if err != nil {
		slog.Warn("list countries failed", logger.Error(err))
		return internal(err)
	}

	writeJSON(w, http.StatusOK, &pb.ListResponse{
		Shows:     toPBShows(shows),
		Genres:    genres,
		Countries: countries,
	})
	return nil
}

func (h *Handler) postShows(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()

	var req pb.AddShowRequest
	if err := decodeJSON(r, &req); err != nil {
		return badRequest("bad request")
	}
	if req.TmdbId == 0 {
		return badRequest("tmdb_id required")
	}

	mediaType := strings.TrimSpace(req.MediaType)
	if mediaType != "movie" && mediaType != "tv" {
		return badRequest("invalid media_type")
	}

	status := strings.TrimSpace(req.Status)
	if status != "planned" && status != "watched" {
		status = "planned"
	}

	detail, err := h.tmdb.FetchDetails(ctx, req.TmdbId, mediaType)
	if err != nil {
		slog.Warn("add show: tmdb fetch failed", logger.Error(err))
		return &Error{Status: http.StatusBadGateway, Message: err.Error()}
	}

	show := showFromDetail(detail, status)
	id, err := h.store.UpsertShow(ctx, &show)
	if err != nil {
		slog.Warn("add show: upsert failed", logger.Error(err))
		return internal(err)
	}

	stored, err := h.store.GetShow(ctx, id)
	if err != nil {
		stored = show
		stored.ID = id
	}

	writeJSON(w, http.StatusOK, &pb.ShowDetail{
		Show:    toPBShow(&stored),
		ImdbUrl: optionalString(imdbURL(stored.IMDbID)),
	})
	return nil
}

func (h *Handler) getShow(w http.ResponseWriter, r *http.Request) error {
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

	writeJSON(w, http.StatusOK, &pb.ShowDetail{
		Show:    toPBShow(&show),
		ImdbUrl: optionalString(imdbURL(show.IMDbID)),
	})
	return nil
}

func (h *Handler) deleteShow(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()

	id, err := idParam(r, "id")
	if err != nil {
		return notFound("not found")
	}

	if err := h.store.DeleteShow(ctx, id); err != nil {
		if isNoRows(err) {
			return notFound("not found")
		}
		return internal(err)
	}

	w.WriteHeader(http.StatusNoContent)
	return nil
}

func (h *Handler) postShowRatings(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()

	id, err := idParam(r, "id")
	if err != nil {
		return notFound("not found")
	}

	var req pb.RatingsRequest
	if err := decodeJSON(r, &req); err != nil {
		return badRequest("bad request")
	}

	update := store.RatingsUpdate{
		BfRating:  nil,
		GfRating:  nil,
		BfComment: nil,
		GfComment: nil,
	}
	if req.BfRating != nil {
		bfRating := parseOptionalRating(req.BfRating)
		update.BfRating = &bfRating
	}
	if req.GfRating != nil {
		gfRating := parseOptionalRating(req.GfRating)
		update.GfRating = &gfRating
	}
	if req.BfComment != nil {
		update.BfComment = &sql.Null[string]{
			V:     valueOrDefault(req.BfComment),
			Valid: true,
		}
	}
	if req.GfComment != nil {
		update.GfComment = &sql.Null[string]{
			V:     valueOrDefault(req.GfComment),
			Valid: true,
		}
	}

	if err := h.store.UpdateRatings(ctx, id, update); err != nil {
		if isNoRows(err) {
			return notFound("not found")
		}
		slog.Warn("show: update ratings failed", logger.Error(err))
		return internal(err)
	}

	show, err := h.store.GetShow(ctx, id)
	if err != nil {
		if isNoRows(err) {
			return notFound("not found")
		}
		return internal(err)
	}

	writeJSON(w, http.StatusOK, &pb.ShowDetail{
		Show:    toPBShow(&show),
		ImdbUrl: optionalString(imdbURL(show.IMDbID)),
	})
	return nil
}

func (h *Handler) postShowToggleStatus(w http.ResponseWriter, r *http.Request) error {
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

	next := nextStatus(show.Status)
	if err := h.store.UpdateStatus(ctx, id, next); err != nil {
		if isNoRows(err) {
			return notFound("not found")
		}
		return internal(err)
	}

	updated, err := h.store.GetShow(ctx, id)
	if err != nil {
		if isNoRows(err) {
			return notFound("not found")
		}
		return internal(err)
	}

	writeJSON(w, http.StatusOK, &pb.ShowDetail{
		Show:    toPBShow(&updated),
		ImdbUrl: optionalString(imdbURL(updated.IMDbID)),
	})
	return nil
}

func (h *Handler) postShowClearRatings(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()

	id, err := idParam(r, "id")
	if err != nil {
		return notFound("not found")
	}

	if err := h.store.ClearRatings(ctx, id); err != nil {
		if isNoRows(err) {
			return notFound("not found")
		}
		return internal(err)
	}

	updated, err := h.store.GetShow(ctx, id)
	if err != nil {
		if isNoRows(err) {
			return notFound("not found")
		}
		return internal(err)
	}

	writeJSON(w, http.StatusOK, &pb.ShowDetail{
		Show:    toPBShow(&updated),
		ImdbUrl: optionalString(imdbURL(updated.IMDbID)),
	})
	return nil
}

func (h *Handler) postShowRefreshTMDB(w http.ResponseWriter, r *http.Request) error {
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

	detail, err := h.tmdb.FetchDetails(ctx, show.TMDBID, show.MediaType)
	if err != nil {
		slog.Warn("show: tmdb refresh failed", logger.Error(err))
		return &Error{Status: http.StatusBadGateway, Message: err.Error()}
	}

	updated := showFromDetail(detail, show.Status)
	updated.ID = show.ID

	if _, err := h.store.UpsertShow(ctx, &updated); err != nil {
		slog.Warn("show: tmdb upsert failed", logger.Error(err))
		return internal(err)
	}

	stored, err := h.store.GetShow(ctx, id)
	if err != nil {
		stored = updated
	}

	writeJSON(w, http.StatusOK, &pb.ShowDetail{
		Show:    toPBShow(&stored),
		ImdbUrl: optionalString(imdbURL(stored.IMDbID)),
	})
	return nil
}

func (h *Handler) getGenres(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()

	genres, err := h.store.ListAllGenres(ctx)
	if err != nil {
		return internal(err)
	}
	writeJSON(w, http.StatusOK, genres)
	return nil
}

func parseListFilters(r *http.Request) store.ListFilters {
	country := strings.TrimSpace(r.URL.Query().Get("origin_country"))
	if country != "" {
		country = strings.ToUpper(country)
	}

	filters := store.ListFilters{
		Status:  r.URL.Query().Get("status"),
		Genre:   r.URL.Query().Get("genre"),
		Country: country,
		Sort:    r.URL.Query().Get("sort"),
	}

	if r.URL.Query().Get("unrated") == "1" {
		filters.Unrated = true
	}

	if val := r.URL.Query().Get("year_from"); val != "" {
		if v, err := strconv.Atoi(val); err == nil {
			filters.YearFrom = &v
		}
	}

	if val := r.URL.Query().Get("year_to"); val != "" {
		if v, err := strconv.Atoi(val); err == nil {
			filters.YearTo = &v
		}
	}

	return filters
}

func showFromDetail(detail *tmdb.Detail, status string) store.Show {
	var year sql.Null[int64]
	if y := tmdb.ParseYear(detail.Year); y != nil {
		year = sql.Null[int64]{Valid: true, V: int64(*y)}
	}

	var genres sql.Null[string]
	if len(detail.Genres) > 0 {
		genres = sql.Null[string]{Valid: true, V: strings.Join(detail.Genres, ", ")}
	}

	var overview sql.Null[string]
	if strings.TrimSpace(detail.Overview) != "" {
		overview = sql.Null[string]{Valid: true, V: detail.Overview}
	}

	var poster sql.Null[string]
	if strings.TrimSpace(detail.PosterPath) != "" {
		poster = sql.Null[string]{Valid: true, V: detail.PosterPath}
	}

	var originCountry sql.Null[string]
	if len(detail.OriginCountry) > 0 {
		originCountry = sql.Null[string]{Valid: true, V: strings.Join(detail.OriginCountry, ", ")}
	}

	return store.Show{
		TMDBID:        detail.TMDBID,
		MediaType:     detail.MediaType,
		Title:         detail.Title,
		Year:          year,
		Genres:        genres,
		Overview:      overview,
		PosterPath:    poster,
		IMDbID:        toSQLNullString(detail.IMDbID),
		TMDBRating:    toSQLNullNumeric(detail.VoteAverage),
		TMDBVotes:     toSQLNullNumeric(int64(detail.VoteCount)),
		OriginCountry: originCountry,
		Status:        status,
	}
}

func toPBShow(show *store.Show) *pb.Show {
	return &pb.Show{
		Id:            show.ID,
		TmdbId:        show.TMDBID,
		MediaType:     show.MediaType,
		Title:         show.Title,
		Year:          fromSQLNull(show.Year),
		Genres:        fromSQLNull(show.Genres),
		Overview:      fromSQLNull(show.Overview),
		PosterPath:    fromSQLNull(show.PosterPath),
		ImdbId:        fromSQLNull(show.IMDbID),
		TmdbRating:    fromSQLNull(show.TMDBRating),
		TmdbVotes:     fromSQLNull(show.TMDBVotes),
		Status:        show.Status,
		BfRating:      fromSQLNull(show.BfRating),
		GfRating:      fromSQLNull(show.GfRating),
		BfComment:     fromSQLNull(show.BfComment),
		GfComment:     fromSQLNull(show.GfComment),
		CreatedAt:     show.CreatedAt,
		UpdatedAt:     show.UpdatedAt,
		OriginCountry: splitCommaValues(show.OriginCountry),
	}
}

func toPBShows(shows []store.Show) []*pb.Show {
	out := make([]*pb.Show, 0, len(shows))
	for i := range shows {
		out = append(out, toPBShow(&shows[i]))
	}
	return out
}

func parseOptionalRating(val *int32) sql.Null[int64] {
	if val == nil {
		return sql.Null[int64]{}
	}
	n := min(max(int(*val), 1), 10)
	return sql.Null[int64]{Valid: true, V: int64(n)}
}

func nextStatus(current string) string {
	switch strings.ToLower(strings.TrimSpace(current)) {
	case "planned":
		return "watched"
	case "watched":
		return "planned"
	default:
		return "planned"
	}
}
