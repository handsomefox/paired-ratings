// Package handlers wires HTTP routing and API handlers.
package handlers

import (
	"bytes"
	"cmp"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/handsomefox/website-rating/internal/gen/pb"
	"github.com/handsomefox/website-rating/internal/store"
	"github.com/handsomefox/website-rating/internal/tmdb"
)

type Handler struct {
	store     *store.Store
	tmdb      *tmdb.Client
	password  string
	passHash  string
	imageBase string
	bfName    string
	gfName    string
	genres    genreCache
	countries countryCache
	languages languageCache
}

type Config struct {
	Store     *store.Store
	TMDB      *tmdb.Client
	Password  string
	ImageBase string
	BfName    string
	GfName    string
}

type genreCache struct {
	mu        sync.RWMutex
	movie     map[int]string
	tv        map[int]string
	movieList []tmdb.Genre
	tvList    []tmdb.Genre
	fetchedAt time.Time
}

type countryCache struct {
	mu        sync.RWMutex
	items     []tmdb.Country
	fetchedAt time.Time
}

type languageCache struct {
	mu        sync.RWMutex
	items     []tmdb.Language
	fetchedAt time.Time
}

type searchFilters struct {
	MediaType        string
	YearFrom         *int
	YearTo           *int
	MinRating        *float64
	MinVotes         *int
	Sort             string
	Page             int
	GenreIDs         []int
	GenreMode        string
	GenreRaw         string
	OriginCountry    string
	OriginalLanguage string
}

type searchPage struct {
	Results      []tmdb.SearchResult
	Page         int
	TotalPages   int
	TotalResults int
}

func New(cfg *Config) (*Handler, error) {
	if cfg.Store == nil {
		return nil, errors.New("store is required")
	}
	if cfg.TMDB == nil {
		return nil, errors.New("tmdb client is required")
	}
	if strings.TrimSpace(cfg.Password) == "" {
		return nil, errors.New("password is required")
	}

	bfName := strings.TrimSpace(cfg.BfName)
	if bfName == "" {
		bfName = "Boyfriend"
	}
	gfName := strings.TrimSpace(cfg.GfName)
	if gfName == "" {
		gfName = "Girlfriend"
	}

	return &Handler{
		store:     cfg.Store,
		tmdb:      cfg.TMDB,
		password:  cfg.Password,
		passHash:  hashPassword(cfg.Password),
		imageBase: cfg.ImageBase,
		bfName:    bfName,
		gfName:    gfName,
	}, nil
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Method(http.MethodGet, "/session", Adapt(h.getSession))
	r.Method(http.MethodPost, "/login", Adapt(h.postLogin))

	r.Group(func(r chi.Router) {
		r.Use(h.MiddlewareRequireAuth)

		r.Method(http.MethodPost, "/logout", Adapt(h.postLogout))
		r.Method(http.MethodGet, "/search", Adapt(h.getSearch))
		r.Method(http.MethodGet, "/search/genres", Adapt(h.getSearchGenres))
		r.Method(http.MethodGet, "/search/countries", Adapt(h.getSearchCountries))
		r.Method(http.MethodGet, "/search/languages", Adapt(h.getSearchLanguages))
		r.Method(http.MethodGet, "/search/resolve", Adapt(h.getSearchResolve))
		r.Method(http.MethodGet, "/genres", Adapt(h.getGenres))

		r.Route("/shows", func(r chi.Router) {
			r.Method(http.MethodGet, "/", Adapt(h.getShows))
			r.Method(http.MethodPost, "/", Adapt(h.postShows))

			r.Route("/{id:[0-9]+}", func(r chi.Router) {
				r.Method(http.MethodGet, "/", Adapt(h.getShow))
				r.Method(http.MethodDelete, "/", Adapt(h.deleteShow))

				r.Method(http.MethodPost, "/ratings", Adapt(h.postShowRatings))
				r.Method(http.MethodPost, "/toggle-status", Adapt(h.postShowToggleStatus))
				r.Method(http.MethodPost, "/clear-ratings", Adapt(h.postShowClearRatings))
				r.Method(http.MethodPost, "/refresh-tmdb", Adapt(h.postShowRefreshTMDB))
			})
		})

		r.Method(http.MethodPost, "/export", Adapt(h.postExport))
		r.Method(http.MethodPost, "/refresh-tmdb", Adapt(h.postRefreshTMDBAll))
	})
}

func (h *Handler) getSession(w http.ResponseWriter, r *http.Request) error {
	authed := h.isAuthenticated(r)

	resp := &pb.SessionResponse{Authenticated: ptr(authed)}
	if authed {
		resp.ImageBase = ptr(h.imageBase)
		resp.BfName = ptr(h.bfName)
		resp.GfName = ptr(h.gfName)
	}

	writeJSON(w, http.StatusOK, resp)
	return nil
}

func (h *Handler) postLogin(w http.ResponseWriter, r *http.Request) error {
	var req pb.LoginRequest
	if err := decodeJSON(r, &req); err != nil {
		return badRequest("bad request")
	}

	if req.Password != h.password {
		slog.Warn("login: invalid password", slog.String("remote", r.RemoteAddr))
		return unauthorized("invalid password")
	}

	setAuthCookie(w, r, h.passHash)
	writeJSON(w, http.StatusOK, &pb.SessionResponse{
		Authenticated: ptr(true),
		ImageBase:     ptr(h.imageBase),
		BfName:        ptr(h.bfName),
		GfName:        ptr(h.gfName),
	})
	return nil
}

func (h *Handler) postLogout(w http.ResponseWriter, r *http.Request) error {
	clearAuthCookie(w, r)
	writeJSON(w, http.StatusOK, &pb.SessionResponse{Authenticated: ptr(false)})
	return nil
}

func (h *Handler) getShows(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	filters := parseListFilters(r)

	shows, err := h.store.ListShows(ctx, filters)
	if err != nil {
		slog.Warn("list shows failed", slog.Any("err", err))
		return internal(err)
	}

	genres, err := h.store.ListAllGenres(ctx)
	if err != nil {
		slog.Warn("list genres failed", slog.Any("err", err))
		return internal(err)
	}

	countries, err := h.store.ListAllCountries(ctx)
	if err != nil {
		slog.Warn("list countries failed", slog.Any("err", err))
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
		slog.Warn("add show: tmdb fetch failed", slog.Any("err", err))
		return &Error{Status: http.StatusBadGateway, Message: err.Error()}
	}

	show := showFromDetail(detail, status)
	id, err := h.store.UpsertShow(ctx, &show)
	if err != nil {
		slog.Warn("add show: upsert failed", slog.Any("err", err))
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
		slog.Warn("show: update ratings failed", slog.Any("err", err))
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
		slog.Warn("show: tmdb refresh failed", slog.Any("err", err))
		return &Error{Status: http.StatusBadGateway, Message: err.Error()}
	}

	updated := showFromDetail(detail, show.Status)
	updated.ID = show.ID

	if _, err := h.store.UpsertShow(ctx, &updated); err != nil {
		slog.Warn("show: tmdb upsert failed", slog.Any("err", err))
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

func (h *Handler) getSearchGenres(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()

	movieGenres, tvGenres, err := h.fetchGenreLists(ctx)
	if err != nil {
		return &Error{Status: http.StatusBadGateway, Message: err.Error()}
	}

	resp := &pb.SearchGenresResponse{
		MovieGenres: toPBGenres(movieGenres),
		TvGenres:    toPBGenres(tvGenres),
	}

	writeJSON(w, http.StatusOK, resp)
	return nil
}

func (h *Handler) getSearchCountries(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()

	countries, err := h.fetchCountryList(ctx)
	if err != nil {
		return &Error{Status: http.StatusBadGateway, Message: err.Error()}
	}

	resp := &pb.SearchCountriesResponse{
		Countries: toPBCountries(countries),
	}
	writeJSON(w, http.StatusOK, resp)
	return nil
}

func (h *Handler) getSearchLanguages(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()

	languages, err := h.fetchLanguageList(ctx)
	if err != nil {
		return &Error{Status: http.StatusBadGateway, Message: err.Error()}
	}

	resp := &pb.SearchLanguagesResponse{
		Languages: toPBLanguages(languages),
	}
	writeJSON(w, http.StatusOK, resp)
	return nil
}

func (h *Handler) getSearchResolve(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	tmdbIDRaw := strings.TrimSpace(r.URL.Query().Get("tmdb_id"))
	if tmdbIDRaw == "" {
		return badRequest("tmdb_id required")
	}
	tmdbID, err := strconv.ParseInt(tmdbIDRaw, 10, 64)
	if err != nil || tmdbID <= 0 {
		return badRequest("invalid tmdb_id")
	}

	mediaType := strings.TrimSpace(r.URL.Query().Get("media_type"))
	if mediaType != "movie" && mediaType != "tv" {
		return badRequest("invalid media_type")
	}

	detail, err := h.tmdb.FetchDetails(ctx, tmdbID, mediaType)
	if err != nil {
		slog.Warn("search resolve failed", slog.Any("err", err))
		return internal(err)
	}

	tmdbURL := fmt.Sprintf("https://www.themoviedb.org/%s/%d", mediaType, tmdbID)
	imdbURL := ""
	if strings.TrimSpace(detail.IMDbID) != "" {
		imdbURL = "https://www.imdb.com/title/" + detail.IMDbID
	}

	writeJSON(w, http.StatusOK, &pb.SearchResolveResponse{
		ImdbUrl: optionalString(imdbURL),
		TmdbUrl: optionalString(tmdbURL),
	})
	return nil
}

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
		slog.Warn("export write failed", slog.Any("err", err))
	}
	return nil
}

func (h *Handler) postRefreshTMDBAll(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()

	items, err := h.store.ListTMDBMissing(ctx)
	if err != nil {
		return internal(err)
	}

	for _, item := range items {
		detail, err := h.tmdb.FetchDetails(ctx, item.TMDBID, item.MediaType)
		if err != nil {
			return &Error{Status: http.StatusBadGateway, Message: err.Error()}
		}

		show := showFromDetail(detail, item.Status)
		if _, err := h.store.UpsertShow(ctx, &show); err != nil {
			return internal(err)
		}
	}

	writeJSON(w, http.StatusOK, &pb.RefreshResponse{Updated: toInt32(len(items))})
	return nil
}

func (h *Handler) getSearch(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()

	req := parseSearchRequest(r)
	query := strings.TrimSpace(req.Q)
	filters := searchFiltersFromRequest(req)

	if query != "" {
		if filters.MediaType != "movie" && filters.MediaType != "tv" {
			return badRequest("media_type required")
		}
	}

	pageData, err := h.searchTMDB(ctx, query, filters)
	if err != nil {
		return &Error{Status: http.StatusBadGateway, Message: err.Error()}
	}

	inLibrary, err := h.lookupInLibrary(ctx, pageData.Results)
	if err != nil {
		return internal(err)
	}

	movieGenres, tvGenres := h.genreMaps(ctx)

	results := make([]*pb.SearchResult, 0, len(pageData.Results))
	for _, item := range pageData.Results {
		results = append(results, &pb.SearchResult{
			Id:               item.ID,
			MediaType:        item.MediaType,
			Title:            item.Title,
			Year:             item.Year,
			PosterPath:       item.PosterPath,
			Overview:         item.Overview,
			VoteAverage:      item.VoteAverage,
			VoteCount:        toInt32(item.VoteCount),
			InLibrary:        inLibrary[store.TMDBRef{ID: item.ID, MediaType: item.MediaType}],
			Genres:           genreNamesFor(item, movieGenres, tvGenres),
			OriginCountry:    item.OriginCountry,
			OriginalLanguage: item.OriginalLanguage,
		})
	}

	writeJSON(w, http.StatusOK, &pb.SearchResponse{
		Results:      results,
		Page:         toInt32(pageData.Page),
		TotalPages:   toInt32(pageData.TotalPages),
		TotalResults: toInt32(pageData.TotalResults),
	})
	return nil
}

func (h *Handler) searchTMDB(ctx context.Context, query string, filters searchFilters) (searchPage, error) {
	const perPage = 20
	const tmdbPageSize = 20

	if filters.Page < 1 {
		filters.Page = 1
	}

	if query != "" {
		mediaType := strings.TrimSpace(filters.MediaType)
		type pageFetcher func(page int) (tmdb.SearchPage, error)
		fetch := func(page int) (tmdb.SearchPage, error) {
			return h.tmdb.SearchPage(ctx, query, mediaType, page)
		}
		startFromFirst := !filters.isEmpty() || filters.Sort != "relevance"
		return h.searchWithFilterPaging(ctx, fetch, filters, perPage, tmdbPageSize, startFromFirst, true)
	}

	if filters.isEmpty() {
		return searchPage{}, nil
	}

	discoverFilters := tmdb.DiscoverFilters{
		YearFrom:         filters.YearFrom,
		YearTo:           filters.YearTo,
		MinRating:        filters.MinRating,
		MinVotes:         filters.MinVotes,
		Genres:           filters.GenreRaw,
		OriginCountry:    filters.OriginCountry,
		OriginalLanguage: filters.OriginalLanguage,
	}

	switch filters.MediaType {
	case "movie", "tv":
		discoverFilters.Sort = tmdbSort(filters.Sort, filters.MediaType)
		pageData, err := h.tmdb.DiscoverPage(ctx, filters.MediaType, discoverFilters, filters.Page)
		if err != nil {
			return searchPage{}, err
		}
		return searchPage{
			Results:      pageData.Results,
			Page:         filters.Page,
			TotalPages:   pageData.TotalPages,
			TotalResults: pageData.TotalResults,
		}, nil
	default:
		discoverFilters.Sort = tmdbSort(filters.Sort, "movie")
		movies, err := h.tmdb.DiscoverPage(ctx, "movie", discoverFilters, filters.Page)
		if err != nil {
			return searchPage{}, err
		}
		discoverFilters.Sort = tmdbSort(filters.Sort, "tv")
		tv, err := h.tmdb.DiscoverPage(ctx, "tv", discoverFilters, filters.Page)
		if err != nil {
			return searchPage{}, err
		}
		found := make([]tmdb.SearchResult, 0, len(movies.Results)+len(tv.Results))
		found = append(found, movies.Results...)
		found = append(found, tv.Results...)

		return searchPage{
			Results:      found,
			Page:         filters.Page,
			TotalPages:   max(movies.TotalPages, tv.TotalPages),
			TotalResults: movies.TotalResults + tv.TotalResults,
		}, nil
	}
}

func (h *Handler) searchWithFilterPaging(
	ctx context.Context,
	fetch func(page int) (tmdb.SearchPage, error),
	filters searchFilters,
	perPage int,
	remotePageSize int,
	startFromFirst bool,
	applyFilters bool,
) (searchPage, error) {
	if filters.Page < 1 {
		filters.Page = 1
	}
	offset := (filters.Page - 1) * perPage
	tmdbPage := 1
	if !startFromFirst {
		offset = offset % remotePageSize
		tmdbPage = (filters.Page-1)*perPage/remotePageSize + 1
	}

	collected := make([]tmdb.SearchResult, 0, perPage*2)
	totalResults := 0
	totalPages := 1
	exhausted := false

	for len(collected) < offset+perPage {
		pageData, err := fetch(tmdbPage)
		if err != nil {
			return searchPage{}, err
		}
		if pageData.TotalPages > 0 {
			totalPages = pageData.TotalPages
		}
		if pageData.TotalResults > 0 {
			totalResults = pageData.TotalResults
		}

		if applyFilters {
			filtered := applySearchFilters(pageData.Results, filters)
			collected = append(collected, filtered...)
		} else {
			collected = append(collected, pageData.Results...)
		}

		if tmdbPage >= pageData.TotalPages || pageData.TotalPages == 0 {
			exhausted = true
			break
		}
		tmdbPage++
	}

	if applyFilters && filters.Sort != "relevance" {
		collected = applySearchSort(collected, filters.Sort, false)
	}
	paged := paginateSearchResults(collected, offset, perPage)

	if exhausted {
		filteredTotal := len(collected)
		if filters.Page > 1 {
			filteredTotal = max(filteredTotal, (filters.Page-1)*perPage+len(paged))
		}
		totalResults = filteredTotal
		totalPages = 1
		if totalResults > 0 {
			totalPages = (totalResults + perPage - 1) / perPage
		}
	}

	return searchPage{
		Results:      paged,
		Page:         filters.Page,
		TotalPages:   totalPages,
		TotalResults: totalResults,
	}, nil
}

func parseSearchRequest(r *http.Request) *pb.SearchRequest {
	query := r.URL.Query()
	req := &pb.SearchRequest{
		Q:                strings.TrimSpace(query.Get("q")),
		MediaType:        strings.TrimSpace(query.Get("media_type")),
		YearFrom:         strings.TrimSpace(query.Get("year_from")),
		YearTo:           strings.TrimSpace(query.Get("year_to")),
		MinRating:        strings.TrimSpace(query.Get("min_rating")),
		MinVotes:         strings.TrimSpace(query.Get("min_votes")),
		Sort:             strings.TrimSpace(query.Get("sort")),
		Genres:           strings.TrimSpace(query.Get("genres")),
		OriginCountry:    strings.TrimSpace(query.Get("origin_country")),
		OriginalLanguage: strings.TrimSpace(query.Get("original_language")),
	}

	if val := strings.TrimSpace(query.Get("page")); val != "" {
		if parsed, err := strconv.Atoi(val); err == nil && parsed > 0 {
			req.Page = int32(parsed)
		}
	}

	return req
}

func searchFiltersFromRequest(req *pb.SearchRequest) searchFilters {
	mediaType := strings.TrimSpace(req.MediaType)
	if mediaType != "movie" && mediaType != "tv" {
		mediaType = "all"
	}

	var yearFrom *int
	if val := strings.TrimSpace(req.YearFrom); val != "" {
		if parsed, err := strconv.Atoi(val); err == nil {
			yearFrom = &parsed
		}
	}

	var yearTo *int
	if val := strings.TrimSpace(req.YearTo); val != "" {
		if parsed, err := strconv.Atoi(val); err == nil {
			yearTo = &parsed
		}
	}

	var minRating *float64
	if val := strings.TrimSpace(req.MinRating); val != "" {
		if parsed, err := strconv.ParseFloat(val, 64); err == nil && parsed > 0 {
			minRating = &parsed
		}
	}

	var minVotes *int
	if val := strings.TrimSpace(req.MinVotes); val != "" {
		if parsed, err := strconv.Atoi(val); err == nil && parsed > 0 {
			minVotes = &parsed
		}
	}

	originCountry := strings.TrimSpace(req.OriginCountry)
	if originCountry != "" {
		originCountry = strings.ToUpper(originCountry)
	}

	originalLanguage := strings.TrimSpace(req.OriginalLanguage)
	if originalLanguage != "" {
		originalLanguage = strings.ToLower(originalLanguage)
	}

	genreRaw := strings.TrimSpace(req.Genres)
	genreIDs, genreMode, genreQuery := parseGenreFilter(genreRaw)

	page := 1
	if req.Page > 0 {
		page = int(req.Page)
	}

	sort := strings.TrimSpace(req.Sort)
	switch sort {
	case "rating", "year", "title", "votes":
	default:
		sort = "relevance"
	}

	return searchFilters{
		MediaType:        mediaType,
		YearFrom:         yearFrom,
		YearTo:           yearTo,
		MinRating:        minRating,
		MinVotes:         minVotes,
		Sort:             sort,
		Page:             page,
		GenreIDs:         genreIDs,
		GenreMode:        genreMode,
		GenreRaw:         genreQuery,
		OriginCountry:    originCountry,
		OriginalLanguage: originalLanguage,
	}
}

func (f searchFilters) isEmpty() bool {
	return f.MediaType == "all" &&
		f.YearFrom == nil &&
		f.YearTo == nil &&
		f.MinRating == nil &&
		f.MinVotes == nil &&
		len(f.GenreIDs) == 0 &&
		f.OriginCountry == "" &&
		f.OriginalLanguage == ""
}

func applySearchFilters(items []tmdb.SearchResult, filters searchFilters) []tmdb.SearchResult {
	if len(items) == 0 {
		return items
	}

	out := make([]tmdb.SearchResult, 0, len(items))
	for _, item := range items {
		if filters.MediaType != "all" && item.MediaType != filters.MediaType {
			continue
		}
		if filters.MinRating != nil && item.VoteAverage < *filters.MinRating {
			continue
		}
		if filters.MinVotes != nil && item.VoteCount < *filters.MinVotes {
			continue
		}
		if filters.OriginalLanguage != "" {
			if item.OriginalLanguage == "" || !strings.EqualFold(item.OriginalLanguage, filters.OriginalLanguage) {
				continue
			}
		}
		if filters.OriginCountry != "" {
			if len(item.OriginCountry) == 0 {
				continue
			}
			matched := false
			for _, code := range item.OriginCountry {
				if strings.EqualFold(code, filters.OriginCountry) {
					matched = true
					break
				}
			}
			if !matched {
				continue
			}
		}
		if len(filters.GenreIDs) > 0 {
			if !matchesGenres(item.GenreIDs, filters.GenreIDs, filters.GenreMode) {
				continue
			}
		}
		if filters.YearFrom != nil || filters.YearTo != nil {
			yearPtr := tmdb.ParseYear(item.Year)
			if yearPtr == nil {
				continue
			}
			if filters.YearFrom != nil && *yearPtr < *filters.YearFrom {
				continue
			}
			if filters.YearTo != nil && *yearPtr > *filters.YearTo {
				continue
			}
		}
		out = append(out, item)
	}
	return out
}

func parseGenreFilter(raw string) ([]int, string, string) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, "and", ""
	}

	mode := "and"
	separator := ","
	if strings.Contains(raw, "|") {
		mode = "or"
		separator = "|"
	}

	parts := strings.Split(raw, separator)
	ids := make([]int, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		if val, err := strconv.Atoi(part); err == nil && val > 0 {
			ids = append(ids, val)
		}
	}

	if len(ids) == 0 {
		return nil, "and", ""
	}

	rawParts := make([]string, 0, len(ids))
	for _, id := range ids {
		rawParts = append(rawParts, strconv.Itoa(id))
	}

	return ids, mode, strings.Join(rawParts, separator)
}

func matchesGenres(itemIDs []int, filterIDs []int, mode string) bool {
	if len(filterIDs) == 0 {
		return true
	}
	if len(itemIDs) == 0 {
		return false
	}

	itemSet := make(map[int]struct{}, len(itemIDs))
	for _, id := range itemIDs {
		itemSet[id] = struct{}{}
	}

	if mode == "or" {
		for _, id := range filterIDs {
			if _, ok := itemSet[id]; ok {
				return true
			}
		}
		return false
	}

	for _, id := range filterIDs {
		if _, ok := itemSet[id]; !ok {
			return false
		}
	}
	return true
}

func applySearchSort(items []tmdb.SearchResult, sort string, keepRelevance bool) []tmdb.SearchResult {
	if len(items) < 2 {
		return items
	}

	switch sort {
	case "rating":
		slices.SortFunc(items, func(a, b tmdb.SearchResult) int {
			if a.VoteAverage != b.VoteAverage {
				return cmp.Compare(b.VoteAverage, a.VoteAverage)
			}
			if a.VoteCount != b.VoteCount {
				return cmp.Compare(b.VoteCount, a.VoteCount)
			}
			return strings.Compare(a.Title, b.Title)
		})
	case "votes":
		slices.SortFunc(items, func(a, b tmdb.SearchResult) int {
			if a.VoteCount != b.VoteCount {
				return cmp.Compare(b.VoteCount, a.VoteCount)
			}
			if a.VoteAverage != b.VoteAverage {
				return cmp.Compare(b.VoteAverage, a.VoteAverage)
			}
			return strings.Compare(a.Title, b.Title)
		})
	case "year":
		slices.SortFunc(items, func(a, b tmdb.SearchResult) int {
			yearA := 0
			if val := tmdb.ParseYear(a.Year); val != nil {
				yearA = *val
			}
			yearB := 0
			if val := tmdb.ParseYear(b.Year); val != nil {
				yearB = *val
			}
			if yearA != yearB {
				return cmp.Compare(yearB, yearA)
			}
			return strings.Compare(a.Title, b.Title)
		})
	case "title":
		slices.SortFunc(items, func(a, b tmdb.SearchResult) int {
			left := strings.ToLower(a.Title)
			right := strings.ToLower(b.Title)
			return strings.Compare(left, right)
		})
	default:
		if keepRelevance {
			return items
		}
		slices.SortFunc(items, func(a, b tmdb.SearchResult) int {
			if a.VoteCount != b.VoteCount {
				return cmp.Compare(b.VoteCount, a.VoteCount)
			}
			if a.VoteAverage != b.VoteAverage {
				return cmp.Compare(b.VoteAverage, a.VoteAverage)
			}
			return strings.Compare(a.Title, b.Title)
		})
	}

	return items
}

func tmdbSort(sort, mediaType string) string {
	sort = strings.TrimSpace(sort)
	switch sort {
	case "rating":
		return "vote_average.desc"
	case "votes":
		return "vote_count.desc"
	case "year":
		if mediaType == "tv" {
			return "first_air_date.desc"
		}
		return "primary_release_date.desc"
	case "title":
		if mediaType == "tv" {
			return "original_name.asc"
		}
		return "original_title.asc"
	default:
		return "popularity.desc"
	}
}

func paginateSearchResults(items []tmdb.SearchResult, offset, limit int) []tmdb.SearchResult {
	if offset < 0 {
		offset = 0
	}
	if offset >= len(items) {
		return []tmdb.SearchResult{}
	}
	end := offset + limit
	if end > len(items) {
		end = len(items)
	}
	return items[offset:end]
}

func (h *Handler) lookupInLibrary(ctx context.Context, items []tmdb.SearchResult) (map[store.TMDBRef]bool, error) {
	refs := make([]store.TMDBRef, 0, len(items))
	for _, item := range items {
		mediaType := strings.TrimSpace(item.MediaType)
		if item.ID == 0 || mediaType == "" {
			continue
		}
		refs = append(refs, store.TMDBRef{ID: item.ID, MediaType: mediaType})
	}
	return h.store.InLibraryByTMDB(ctx, refs)
}

func (h *Handler) fetchGenreLists(ctx context.Context) ([]tmdb.Genre, []tmdb.Genre, error) {
	const cacheTTL = 24 * time.Hour

	h.genres.mu.RLock()
	if h.genres.movieList != nil && h.genres.tvList != nil && time.Since(h.genres.fetchedAt) < cacheTTL {
		movie := append([]tmdb.Genre(nil), h.genres.movieList...)
		tv := append([]tmdb.Genre(nil), h.genres.tvList...)
		h.genres.mu.RUnlock()
		return movie, tv, nil
	}
	h.genres.mu.RUnlock()

	movieGenres, err := h.tmdb.FetchGenres(ctx, "movie")
	if err != nil {
		return nil, nil, err
	}
	tvGenres, err := h.tmdb.FetchGenres(ctx, "tv")
	if err != nil {
		return nil, nil, err
	}

	movieMap := make(map[int]string, len(movieGenres))
	for _, g := range movieGenres {
		if strings.TrimSpace(g.Name) == "" {
			continue
		}
		movieMap[g.ID] = g.Name
	}
	tvMap := make(map[int]string, len(tvGenres))
	for _, g := range tvGenres {
		if strings.TrimSpace(g.Name) == "" {
			continue
		}
		tvMap[g.ID] = g.Name
	}

	h.genres.mu.Lock()
	h.genres.movieList = append([]tmdb.Genre(nil), movieGenres...)
	h.genres.tvList = append([]tmdb.Genre(nil), tvGenres...)
	h.genres.movie = movieMap
	h.genres.tv = tvMap
	h.genres.fetchedAt = time.Now()
	h.genres.mu.Unlock()

	return movieGenres, tvGenres, nil
}

func (h *Handler) genreMaps(ctx context.Context) (map[int]string, map[int]string) {
	const cacheTTL = 24 * time.Hour

	h.genres.mu.RLock()
	if h.genres.movie != nil && h.genres.tv != nil && time.Since(h.genres.fetchedAt) < cacheTTL {
		movie := h.genres.movie
		tv := h.genres.tv
		h.genres.mu.RUnlock()
		return movie, tv
	}
	h.genres.mu.RUnlock()

	_, _, err := h.fetchGenreLists(ctx)
	if err != nil {
		return nil, nil
	}

	h.genres.mu.RLock()
	movie := h.genres.movie
	tv := h.genres.tv
	h.genres.mu.RUnlock()
	return movie, tv
}

func genreNamesFor(item tmdb.SearchResult, movieGenres, tvGenres map[int]string) []string {
	var lookup map[int]string
	if item.MediaType == "tv" {
		lookup = tvGenres
	} else {
		lookup = movieGenres
	}

	if lookup == nil || len(item.GenreIDs) == 0 {
		return nil
	}

	out := make([]string, 0, len(item.GenreIDs))
	for _, id := range item.GenreIDs {
		if name, ok := lookup[id]; ok {
			out = append(out, name)
		}
	}
	return out
}

func toPBGenres(items []tmdb.Genre) []*pb.Genre {
	out := make([]*pb.Genre, 0, len(items))
	for _, item := range items {
		out = append(out, &pb.Genre{
			Id:   int32(item.ID),
			Name: item.Name,
		})
	}
	return out
}

func (h *Handler) fetchCountryList(ctx context.Context) ([]tmdb.Country, error) {
	const cacheTTL = 24 * time.Hour

	h.countries.mu.RLock()
	if h.countries.items != nil && time.Since(h.countries.fetchedAt) < cacheTTL {
		cached := append([]tmdb.Country(nil), h.countries.items...)
		h.countries.mu.RUnlock()
		return cached, nil
	}
	h.countries.mu.RUnlock()

	countries, err := h.tmdb.FetchCountries(ctx)
	if err != nil {
		return nil, err
	}
	slices.SortFunc(countries, func(a, b tmdb.Country) int {
		nameA := strings.ToLower(strings.TrimSpace(a.Name))
		nameB := strings.ToLower(strings.TrimSpace(b.Name))
		if nameA == nameB {
			return strings.Compare(strings.ToLower(a.Code), strings.ToLower(b.Code))
		}
		return strings.Compare(nameA, nameB)
	})

	h.countries.mu.Lock()
	h.countries.items = append([]tmdb.Country(nil), countries...)
	h.countries.fetchedAt = time.Now()
	h.countries.mu.Unlock()

	return countries, nil
}

func toPBCountries(items []tmdb.Country) []*pb.Country {
	out := make([]*pb.Country, 0, len(items))
	for _, item := range items {
		out = append(out, &pb.Country{
			Code: item.Code,
			Name: item.Name,
		})
	}
	return out
}

func (h *Handler) fetchLanguageList(ctx context.Context) ([]tmdb.Language, error) {
	const cacheTTL = 24 * time.Hour

	h.languages.mu.RLock()
	if h.languages.items != nil && time.Since(h.languages.fetchedAt) < cacheTTL {
		cached := append([]tmdb.Language(nil), h.languages.items...)
		h.languages.mu.RUnlock()
		return cached, nil
	}
	h.languages.mu.RUnlock()

	languages, err := h.tmdb.FetchLanguages(ctx)
	if err != nil {
		return nil, err
	}
	slices.SortFunc(languages, func(a, b tmdb.Language) int {
		nameA := strings.ToLower(strings.TrimSpace(a.Name))
		nameB := strings.ToLower(strings.TrimSpace(b.Name))
		if nameA == nameB {
			return strings.Compare(strings.ToLower(a.Code), strings.ToLower(b.Code))
		}
		return strings.Compare(nameA, nameB)
	})

	h.languages.mu.Lock()
	h.languages.items = append([]tmdb.Language(nil), languages...)
	h.languages.fetchedAt = time.Now()
	h.languages.mu.Unlock()

	return languages, nil
}

func toPBLanguages(items []tmdb.Language) []*pb.Language {
	out := make([]*pb.Language, 0, len(items))
	for _, item := range items {
		out = append(out, &pb.Language{
			Code: item.Code,
			Name: item.Name,
		})
	}
	return out
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
