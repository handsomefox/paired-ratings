// Package handlers wires HTTP handlers for the app.
package handlers

import (
	"cmp"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"html/template"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"slices"
	"strconv"
	"strings"
	"time"

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
	templates map[string]*template.Template
}

type Config struct {
	Store     *store.Store
	TMDB      *tmdb.Client
	Password  string
	ImageBase string
	BfName    string
	GfName    string
}

type listPageData struct {
	Shows         []store.Show
	Filters       store.ListFilters
	Genres        []string
	Sort          string
	Status        string
	YearFrom      string
	YearTo        string
	Genre         string
	Unrated       bool
	ImageBase     string
	BfName        string
	GfName        string
	HasResults    bool
	Authenticated bool
}

type searchPageData struct {
	Query         string
	MediaType     string
	YearFrom      string
	YearTo        string
	MinRating     string
	MinVotes      string
	Sort          string
	Results       []searchPageResult
	ImageBase     string
	Authenticated bool
}

type detailPageData struct {
	Show          store.Show
	ImageBase     string
	BfName        string
	GfName        string
	Authenticated bool
}

type loginPageData struct {
	Error         string
	Authenticated bool
}

func New(cfg Config) (*Handler, error) {
	if cfg.Store == nil {
		return nil, errors.New("store is required")
	}
	if cfg.TMDB == nil {
		return nil, errors.New("tmdb client is required")
	}
	if strings.TrimSpace(cfg.Password) == "" {
		return nil, errors.New("password is required")
	}
	tmpl, err := parseTemplates()
	if err != nil {
		return nil, err
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
		templates: tmpl,
	}, nil
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/login", h.loginHandler)
	mux.HandleFunc("/logout", h.logoutHandler)
	mux.HandleFunc("/search", h.requireAuth(h.searchHandler))
	mux.HandleFunc("/api/search", h.requireAuth(h.searchAPIHandler))
	mux.HandleFunc("/add", h.requireAuth(h.addHandler))
	mux.HandleFunc("/delete", h.requireAuth(h.deleteHandler))
	mux.HandleFunc("/export", h.requireAuth(h.exportHandler))
	mux.HandleFunc("/refresh-tmdb", h.requireAuth(h.refreshTMDBHandler))
	mux.HandleFunc("/show/", h.requireAuth(h.showHandler))
	mux.HandleFunc("/", h.requireAuth(h.listHandler))
}

func parseTemplates() (map[string]*template.Template, error) {
	funcs := template.FuncMap{
		"shortGenres":    shortGenres,
		"ratingText":     ratingText,
		"combinedRating": combinedRatingText,
		"formatScore":    formatScore,
		"formatVotes":    formatVotes,
		"imdbURL":        imdbURL,
	}
	base, err := template.New("layout.html").Funcs(funcs).ParseFS(os.DirFS("web/templates"), "layout.html")
	if err != nil {
		return nil, err
	}
	pages := []string{
		"list.html",
		"search.html",
		"detail.html",
		"login.html",
	}
	out := make(map[string]*template.Template, len(pages))
	for _, page := range pages {
		tpl, err := base.Clone()
		if err != nil {
			return nil, err
		}
		if _, err := tpl.ParseFS(os.DirFS("web/templates"), page); err != nil {
			return nil, err
		}
		out[page] = tpl
	}
	return out, nil
}

func (h *Handler) loginHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		h.render(w, "login.html", loginPageData{Authenticated: false})
	case http.MethodPost:
		if err := r.ParseForm(); err != nil {
			slog.Warn("login: parse form failed", slog.Any("err", err))
			http.Error(w, "bad form", http.StatusBadRequest)
			return
		}
		if r.FormValue("password") != h.password {
			slog.Warn("login: invalid password", slog.String("remote", r.RemoteAddr))
			h.render(w, "login.html", loginPageData{
				Error:         "Invalid password",
				Authenticated: false,
			})
			return
		}
		setAuthCookie(w, r, h.passHash)
		http.Redirect(w, r, "/", http.StatusSeeOther)
	default:
		w.WriteHeader(http.StatusMethodNotAllowed)
	}
}

func (h *Handler) logoutHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if !sameOrigin(r) {
		slog.Warn("logout: forbidden origin", slog.String("remote", r.RemoteAddr))
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	clearAuthCookie(w, r)
	http.Redirect(w, r, "/login", http.StatusSeeOther)
}

func (h *Handler) listHandler(w http.ResponseWriter, r *http.Request) {
	filters := store.ListFilters{
		Status: r.URL.Query().Get("status"),
		Genre:  r.URL.Query().Get("genre"),
		Sort:   r.URL.Query().Get("sort"),
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

	shows, err := h.store.ListShows(filters)
	if err != nil {
		slog.Warn("list shows failed", slog.Any("err", err))
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	genres, err := h.store.ListAllGenres()
	if err != nil {
		slog.Warn("list genres failed", slog.Any("err", err))
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	data := listPageData{
		Shows:         shows,
		Filters:       filters,
		Genres:        genres,
		Sort:          filters.Sort,
		Status:        filters.Status,
		YearFrom:      r.URL.Query().Get("year_from"),
		YearTo:        r.URL.Query().Get("year_to"),
		Genre:         filters.Genre,
		Unrated:       filters.Unrated,
		ImageBase:     h.imageBase,
		BfName:        h.bfName,
		GfName:        h.gfName,
		HasResults:    len(shows) > 0,
		Authenticated: true,
	}
	if data.Status == "" {
		data.Status = "all"
	}
	if data.Sort == "" {
		data.Sort = "updated"
	}
	h.render(w, "list.html", data)
}

func (h *Handler) searchHandler(w http.ResponseWriter, r *http.Request) {
	query := strings.TrimSpace(r.URL.Query().Get("q"))
	filters := parseSearchFilters(r)
	pageData, err := h.searchTMDB(query, filters)
	if err != nil {
		slog.Warn("search tmdb failed", slog.Any("err", err))
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	inLibrary, err := h.lookupInLibrary(pageData.Results)
	if err != nil {
		slog.Warn("search lookup failed", slog.Any("err", err))
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	pageResults := make([]searchPageResult, 0, len(pageData.Results))
	for _, item := range pageData.Results {
		pageResults = append(pageResults, searchPageResult{
			SearchResult: item,
			InLibrary:    inLibrary[store.TMDBRef{ID: item.ID, MediaType: item.MediaType}],
		})
	}
	data := searchPageData{
		Query:         query,
		MediaType:     filters.MediaType,
		YearFrom:      r.URL.Query().Get("year_from"),
		YearTo:        r.URL.Query().Get("year_to"),
		MinRating:     r.URL.Query().Get("min_rating"),
		MinVotes:      r.URL.Query().Get("min_votes"),
		Sort:          filters.Sort,
		Results:       pageResults,
		ImageBase:     h.imageBase,
		Authenticated: true,
	}
	h.render(w, "search.html", data)
}

type searchAPIResult struct {
	ID          int64   `json:"id"`
	MediaType   string  `json:"media_type"`
	Title       string  `json:"title"`
	Year        string  `json:"year"`
	PosterPath  string  `json:"poster_path"`
	Overview    string  `json:"overview"`
	VoteAverage float64 `json:"vote_average"`
	VoteCount   int     `json:"vote_count"`
	InLibrary   bool    `json:"in_library"`
}

type searchAPIResponse struct {
	Results      []searchAPIResult `json:"results"`
	Page         int               `json:"page"`
	TotalPages   int               `json:"total_pages"`
	TotalResults int               `json:"total_results"`
}

type searchFilters struct {
	MediaType string
	YearFrom  *int
	YearTo    *int
	MinRating *float64
	MinVotes  *int
	Sort      string
	Page      int
}

type searchPageResult struct {
	tmdb.SearchResult
	InLibrary bool
}

type searchPage struct {
	Results      []tmdb.SearchResult
	Page         int
	TotalPages   int
	TotalResults int
}

func (h *Handler) searchAPIHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	query := strings.TrimSpace(r.URL.Query().Get("q"))
	filters := parseSearchFilters(r)
	results := []searchAPIResult{}
	pageData, err := h.searchTMDB(query, filters)
	if err != nil {
		slog.Warn("search api tmdb failed", slog.Any("err", err))
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	inLibrary, err := h.lookupInLibrary(pageData.Results)
	if err != nil {
		slog.Warn("search api lookup failed", slog.Any("err", err))
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	results = make([]searchAPIResult, 0, len(pageData.Results))
	for _, item := range pageData.Results {
		results = append(results, searchAPIResult{
			ID:          item.ID,
			MediaType:   item.MediaType,
			Title:       item.Title,
			Year:        item.Year,
			PosterPath:  item.PosterPath,
			Overview:    item.Overview,
			VoteAverage: item.VoteAverage,
			VoteCount:   item.VoteCount,
			InLibrary:   inLibrary[store.TMDBRef{ID: item.ID, MediaType: item.MediaType}],
		})
	}
	response := searchAPIResponse{
		Results:      results,
		Page:         pageData.Page,
		TotalPages:   pageData.TotalPages,
		TotalResults: pageData.TotalResults,
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (h *Handler) searchTMDB(query string, filters searchFilters) (searchPage, error) {
	const perPage = 10
	const tmdbPageSize = 20
	if filters.Page < 1 {
		filters.Page = 1
	}
	index := (filters.Page - 1) * perPage

	if query != "" {
		tmdbPage := index/tmdbPageSize + 1
		offset := index % tmdbPageSize
		pageData, err := h.tmdb.SearchPage(query, tmdbPage)
		if err != nil {
			return searchPage{}, err
		}
		filtered := applySearchFilters(pageData.Results, filters)
		sorted := applySearchSort(filtered, filters.Sort, true)
		pageData.Results = paginateSearchResults(sorted, offset, perPage)
		totalPages := 1
		if pageData.TotalResults > 0 {
			totalPages = (pageData.TotalResults + perPage - 1) / perPage
		}
		return searchPage{
			Results:      pageData.Results,
			Page:         filters.Page,
			TotalPages:   totalPages,
			TotalResults: pageData.TotalResults,
		}, nil
	}
	if filters.isEmpty() {
		return searchPage{}, nil
	}
	discoverFilters := tmdb.DiscoverFilters{
		YearFrom:  filters.YearFrom,
		YearTo:    filters.YearTo,
		MinRating: filters.MinRating,
	}
	switch filters.MediaType {
	case "movie", "tv":
		tmdbPage := index/tmdbPageSize + 1
		offset := index % tmdbPageSize
		pageData, err := h.tmdb.DiscoverPage(filters.MediaType, discoverFilters, tmdbPage)
		if err != nil {
			return searchPage{}, err
		}
		filtered := applySearchFilters(pageData.Results, filters)
		pageData.Results = paginateSearchResults(applySearchSort(filtered, filters.Sort, false), offset, perPage)
		totalPages := 1
		if pageData.TotalResults > 0 {
			totalPages = (pageData.TotalResults + perPage - 1) / perPage
		}
		return searchPage{
			Results:      pageData.Results,
			Page:         filters.Page,
			TotalPages:   totalPages,
			TotalResults: pageData.TotalResults,
		}, nil
	default:
		tmdbPageSizeAll := tmdbPageSize * 2
		tmdbPage := index/tmdbPageSizeAll + 1
		offset := index % tmdbPageSizeAll
		movies, err := h.tmdb.DiscoverPage("movie", discoverFilters, tmdbPage)
		if err != nil {
			return searchPage{}, err
		}
		tv, err := h.tmdb.DiscoverPage("tv", discoverFilters, tmdbPage)
		if err != nil {
			return searchPage{}, err
		}
		found := append(movies.Results, tv.Results...)
		filtered := applySearchFilters(found, filters)
		sorted := applySearchSort(filtered, filters.Sort, false)
		paged := paginateSearchResults(sorted, offset, perPage)
		totalResults := movies.TotalResults + tv.TotalResults
		totalPages := 1
		if totalResults > 0 {
			totalPages = (totalResults + perPage - 1) / perPage
		}
		return searchPage{
			Results:      paged,
			Page:         filters.Page,
			TotalPages:   totalPages,
			TotalResults: totalResults,
		}, nil
	}
}

func parseSearchFilters(r *http.Request) searchFilters {
	mediaType := strings.TrimSpace(r.URL.Query().Get("media_type"))
	if mediaType != "movie" && mediaType != "tv" {
		mediaType = "all"
	}
	var yearFrom *int
	if val := strings.TrimSpace(r.URL.Query().Get("year_from")); val != "" {
		if parsed, err := strconv.Atoi(val); err == nil {
			yearFrom = &parsed
		}
	}
	var yearTo *int
	if val := strings.TrimSpace(r.URL.Query().Get("year_to")); val != "" {
		if parsed, err := strconv.Atoi(val); err == nil {
			yearTo = &parsed
		}
	}
	var minRating *float64
	if val := strings.TrimSpace(r.URL.Query().Get("min_rating")); val != "" {
		if parsed, err := strconv.ParseFloat(val, 64); err == nil && parsed > 0 {
			minRating = &parsed
		}
	}
	var minVotes *int
	if val := strings.TrimSpace(r.URL.Query().Get("min_votes")); val != "" {
		if parsed, err := strconv.Atoi(val); err == nil && parsed > 0 {
			minVotes = &parsed
		}
	}
	page := 1
	if val := strings.TrimSpace(r.URL.Query().Get("page")); val != "" {
		if parsed, err := strconv.Atoi(val); err == nil && parsed > 0 {
			page = parsed
		}
	}
	sort := strings.TrimSpace(r.URL.Query().Get("sort"))
	switch sort {
	case "rating", "year", "title", "votes":
	default:
		sort = "relevance"
	}
	return searchFilters{
		MediaType: mediaType,
		YearFrom:  yearFrom,
		YearTo:    yearTo,
		MinRating: minRating,
		MinVotes:  minVotes,
		Sort:      sort,
		Page:      page,
	}
}

func (f searchFilters) isEmpty() bool {
	return f.MediaType == "all" && f.YearFrom == nil && f.YearTo == nil && f.MinRating == nil
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

func (h *Handler) lookupInLibrary(items []tmdb.SearchResult) (map[store.TMDBRef]bool, error) {
	refs := make([]store.TMDBRef, 0, len(items))
	for _, item := range items {
		mediaType := strings.TrimSpace(item.MediaType)
		if item.ID == 0 || mediaType == "" {
			continue
		}
		refs = append(refs, store.TMDBRef{ID: item.ID, MediaType: mediaType})
	}
	return h.store.InLibraryByTMDB(refs)
}

func (h *Handler) addHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if !sameOrigin(r) {
		slog.Warn("add show: forbidden origin", slog.String("remote", r.RemoteAddr))
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	if err := r.ParseForm(); err != nil {
		slog.Warn("add show: parse form failed", slog.Any("err", err))
		http.Error(w, "bad form", http.StatusBadRequest)
		return
	}
	id, err := strconv.ParseInt(r.FormValue("tmdb_id"), 10, 64)
	if err != nil || id == 0 {
		slog.Warn("add show: bad tmdb id", slog.String("value", r.FormValue("tmdb_id")))
		http.Error(w, "bad tmdb id", http.StatusBadRequest)
		return
	}
	mediaType := r.FormValue("media_type")
	status := r.FormValue("status")
	if status != "planned" && status != "watched" {
		status = "planned"
	}

	detail, err := h.tmdb.FetchDetails(id, mediaType)
	if err != nil {
		slog.Warn("add show: tmdb fetch failed", slog.Any("err", err))
		http.Error(w, err.Error(), http.StatusBadGateway)
		return
	}
	show := showFromDetail(detail, status)
	showID, err := h.store.UpsertShow(&show)
	if err != nil {
		slog.Warn("add show: upsert failed", slog.Any("err", err))
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if status == "watched" {
		http.Redirect(w, r, "/show/"+strconv.FormatInt(showID, 10), http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, "/", http.StatusSeeOther)
}

func (h *Handler) deleteHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if !sameOrigin(r) {
		slog.Warn("delete show: forbidden origin", slog.String("remote", r.RemoteAddr))
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	if err := r.ParseForm(); err != nil {
		slog.Warn("delete show: parse form failed", slog.Any("err", err))
		http.Error(w, "bad form", http.StatusBadRequest)
		return
	}
	id, err := strconv.ParseInt(r.FormValue("id"), 10, 64)
	if err != nil || id == 0 {
		slog.Warn("delete show: bad id", slog.String("value", r.FormValue("id")))
		http.Error(w, "bad id", http.StatusBadRequest)
		return
	}
	if err := h.store.DeleteShow(id); err != nil {
		slog.Warn("delete show: delete failed", slog.Any("err", err))
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	http.Redirect(w, r, "/", http.StatusSeeOther)
}

type exportPayload struct {
	ExportedAt string       `json:"exported_at"`
	Shows      []exportShow `json:"shows"`
}

type exportShow struct {
	ID         int64    `json:"id"`
	TMDBID     int64    `json:"tmdb_id"`
	MediaType  string   `json:"media_type"`
	Title      string   `json:"title"`
	Year       *int64   `json:"year,omitempty"`
	Genres     *string  `json:"genres,omitempty"`
	Overview   *string  `json:"overview,omitempty"`
	PosterPath *string  `json:"poster_path,omitempty"`
	IMDbID     *string  `json:"imdb_id,omitempty"`
	TMDBRating *float64 `json:"tmdb_rating,omitempty"`
	TMDBVotes  *int64   `json:"tmdb_votes,omitempty"`
	Status     string   `json:"status"`
	BfRating   *int64   `json:"bf_rating,omitempty"`
	GfRating   *int64   `json:"gf_rating,omitempty"`
	BfComment  *string  `json:"bf_comment,omitempty"`
	GfComment  *string  `json:"gf_comment,omitempty"`
	CreatedAt  string   `json:"created_at"`
	UpdatedAt  string   `json:"updated_at"`
}

func (h *Handler) exportHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if !sameOrigin(r) {
		slog.Warn("export: forbidden origin", slog.String("remote", r.RemoteAddr))
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	shows, err := h.store.ListShows(store.ListFilters{Status: "all"})
	if err != nil {
		slog.Warn("export: list shows failed", slog.Any("err", err))
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	payload := exportPayload{
		ExportedAt: time.Now().UTC().Format(time.RFC3339),
		Shows:      make([]exportShow, 0, len(shows)),
	}
	for i := range shows {
		show := shows[i]
		payload.Shows = append(payload.Shows, exportShow{
			ID:         show.ID,
			TMDBID:     show.TMDBID,
			MediaType:  show.MediaType,
			Title:      show.Title,
			Year:       nullInt64Ptr(show.Year),
			Genres:     nullStringPtr(show.Genres),
			Overview:   nullStringPtr(show.Overview),
			PosterPath: nullStringPtr(show.PosterPath),
			IMDbID:     nullStringPtr(show.IMDbID),
			TMDBRating: nullFloat64Ptr(show.TMDBRating),
			TMDBVotes:  nullInt64Ptr(show.TMDBVotes),
			Status:     show.Status,
			BfRating:   nullInt64Ptr(show.BfRating),
			GfRating:   nullInt64Ptr(show.GfRating),
			BfComment:  nullStringPtr(show.BfComment),
			GfComment:  nullStringPtr(show.GfComment),
			CreatedAt:  show.CreatedAt,
			UpdatedAt:  show.UpdatedAt,
		})
	}
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Content-Disposition", "attachment; filename=show-ratings.json")
	encoder := json.NewEncoder(w)
	encoder.SetIndent("", "  ")
	if err := encoder.Encode(payload); err != nil {
		slog.Warn("export: encode failed", slog.Any("err", err))
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (h *Handler) showHandler(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/show/")
	idStr = strings.Trim(idStr, "/")
	if idStr == "" {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		return
	}

	if r.Method == http.MethodPost {
		h.handleShowPost(w, r, id)
		return
	}

	show, err := h.store.GetShow(id)
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	data := detailPageData{
		Show:          show,
		ImageBase:     h.imageBase,
		BfName:        h.bfName,
		GfName:        h.gfName,
		Authenticated: true,
	}
	h.render(w, "detail.html", data)
}

func (h *Handler) handleShowPost(w http.ResponseWriter, r *http.Request, id int64) {
	if err := r.ParseForm(); err != nil {
		slog.Warn("show: parse form failed", slog.Any("err", err))
		http.Error(w, "bad form", http.StatusBadRequest)
		return
	}
	if !sameOrigin(r) {
		slog.Warn("show: forbidden origin", slog.String("remote", r.RemoteAddr))
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	if r.FormValue("action") == "toggle-status" {
		current := strings.TrimSpace(r.FormValue("status"))
		next := nextStatus(current)
		if err := h.store.UpdateStatus(id, next); err != nil {
			slog.Warn("show: update status failed", slog.Any("err", err))
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		http.Redirect(w, r, r.URL.Path, http.StatusSeeOther)
		return
	}
	if r.FormValue("action") == "clear-ratings" {
		if err := h.store.ClearRatings(id); err != nil {
			slog.Warn("show: clear ratings failed", slog.Any("err", err))
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		http.Redirect(w, r, r.URL.Path, http.StatusSeeOther)
		return
	}
	if r.FormValue("action") == "refresh-tmdb" {
		show, err := h.store.GetShow(id)
		if err != nil {
			slog.Warn("show: fetch failed", slog.Any("err", err))
			http.Error(w, "not found", http.StatusNotFound)
			return
		}
		detail, err := h.tmdb.FetchDetails(show.TMDBID, show.MediaType)
		if err != nil {
			slog.Warn("show: tmdb refresh failed", slog.Any("err", err))
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}
		updated := showFromDetail(detail, show.Status)
		if _, err := h.store.UpsertShow(&updated); err != nil {
			slog.Warn("show: tmdb upsert failed", slog.Any("err", err))
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		http.Redirect(w, r, r.URL.Path, http.StatusSeeOther)
		return
	}

	bfRating := parseRating(r.FormValue("bf_rating"))
	gfRating := parseRating(r.FormValue("gf_rating"))
	bfComment := sql.NullString{}
	if val := strings.TrimSpace(r.FormValue("bf_comment")); val != "" {
		bfComment = sql.NullString{Valid: true, String: val}
	}
	gfComment := sql.NullString{}
	if val := strings.TrimSpace(r.FormValue("gf_comment")); val != "" {
		gfComment = sql.NullString{Valid: true, String: val}
	}
	if err := h.store.UpdateRatings(id, bfRating, gfRating, bfComment, gfComment); err != nil {
		slog.Warn("show: update ratings failed", slog.Any("err", err))
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	http.Redirect(w, r, "/", http.StatusSeeOther)
}

func (h *Handler) render(w http.ResponseWriter, name string, data any) {
	tpl, ok := h.templates[name]
	if !ok {
		slog.Warn("render: template not found", slog.String("template", name))
		http.Error(w, "template not found", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := tpl.ExecuteTemplate(w, "layout", data); err != nil {
		slog.Warn("render: execute failed", slog.Any("err", err), slog.String("template", name))
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func (h *Handler) refreshTMDBHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if !sameOrigin(r) {
		slog.Warn("refresh tmdb: forbidden origin", slog.String("remote", r.RemoteAddr))
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	items, err := h.store.ListTMDBMissing()
	if err != nil {
		slog.Warn("refresh tmdb: list missing failed", slog.Any("err", err))
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	for _, item := range items {
		detail, err := h.tmdb.FetchDetails(item.TMDBID, item.MediaType)
		if err != nil {
			slog.Warn("refresh tmdb: fetch failed", slog.Any("err", err))
			http.Error(w, err.Error(), http.StatusBadGateway)
			return
		}
		show := showFromDetail(detail, item.Status)
		if _, err := h.store.UpsertShow(&show); err != nil {
			slog.Warn("refresh tmdb: upsert failed", slog.Any("err", err))
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}
	http.Redirect(w, r, "/", http.StatusSeeOther)
}

func (h *Handler) requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/login" {
			next(w, r)
			return
		}
		cookie, err := r.Cookie("auth")
		if err != nil || cookie.Value != h.passHash {
			http.Redirect(w, r, "/login", http.StatusSeeOther)
			return
		}
		next(w, r)
	}
}

func setAuthCookie(w http.ResponseWriter, r *http.Request, value string) {
	http.SetCookie(w, &http.Cookie{
		Name:     "auth",
		Value:    value,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   isSecureRequest(r),
	})
}

func clearAuthCookie(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     "auth",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   isSecureRequest(r),
	})
}

func isSecureRequest(r *http.Request) bool {
	if r.TLS != nil {
		return true
	}
	return strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https")
}

func sameOrigin(r *http.Request) bool {
	origin := strings.TrimSpace(r.Header.Get("Origin"))
	if origin != "" {
		parsed, err := url.Parse(origin)
		if err != nil {
			return false
		}
		return hostMatches(r.Host, parsed.Host)
	}
	referer := strings.TrimSpace(r.Header.Get("Referer"))
	if referer != "" {
		parsed, err := url.Parse(referer)
		if err != nil {
			return false
		}
		return hostMatches(r.Host, parsed.Host)
	}
	return false
}

func hostMatches(left, right string) bool {
	if strings.EqualFold(left, right) {
		return true
	}
	return strings.EqualFold(stripPort(left), stripPort(right))
}

func stripPort(host string) string {
	if host == "" {
		return host
	}
	if idx := strings.LastIndex(host, ":"); idx > -1 {
		return host[:idx]
	}
	return host
}

func hashPassword(password string) string {
	sum := sha256.Sum256([]byte(password))
	return hex.EncodeToString(sum[:])
}

func shortGenres(genres sql.NullString) string {
	if !genres.Valid {
		return ""
	}
	parts := strings.Split(genres.String, ",")
	out := make([]string, 0, 2)
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		out = append(out, p)
		if len(out) == 2 {
			break
		}
	}
	return strings.Join(out, ", ")
}

func showFromDetail(detail *tmdb.Detail, status string) store.Show {
	var year sql.NullInt64
	if y := tmdb.ParseYear(detail.Year); y != nil {
		year = sql.NullInt64{Valid: true, Int64: int64(*y)}
	}
	var genres sql.NullString
	if len(detail.Genres) > 0 {
		genres = sql.NullString{Valid: true, String: strings.Join(detail.Genres, ", ")}
	}
	var overview sql.NullString
	if strings.TrimSpace(detail.Overview) != "" {
		overview = sql.NullString{Valid: true, String: detail.Overview}
	}
	var poster sql.NullString
	if strings.TrimSpace(detail.PosterPath) != "" {
		poster = sql.NullString{Valid: true, String: detail.PosterPath}
	}
	return store.Show{
		TMDBID:     detail.TMDBID,
		MediaType:  detail.MediaType,
		Title:      detail.Title,
		Year:       year,
		Genres:     genres,
		Overview:   overview,
		PosterPath: poster,
		IMDbID:     toNullString(detail.IMDbID),
		TMDBRating: toNullFloat(detail.VoteAverage),
		TMDBVotes:  toNullInt(detail.VoteCount),
		Status:     status,
	}
}

func ratingText(val sql.NullInt64) string {
	if !val.Valid {
		return "-"
	}
	return strconv.FormatInt(val.Int64, 10)
}

func combinedRatingText(bf, gf sql.NullInt64) string {
	if !bf.Valid && !gf.Valid {
		return "-"
	}
	if bf.Valid && !gf.Valid {
		return ratingText(bf)
	}
	if gf.Valid && !bf.Valid {
		return ratingText(gf)
	}
	avg := (float64(bf.Int64) + float64(gf.Int64)) / 2.0
	if avg == float64(int64(avg)) {
		return strconv.FormatInt(int64(avg), 10)
	}
	return strconv.FormatFloat(avg, 'f', 1, 64)
}

func parseRating(val string) sql.NullInt64 {
	val = strings.TrimSpace(val)
	if val == "" {
		return sql.NullInt64{}
	}
	n, err := strconv.Atoi(val)
	if err != nil {
		return sql.NullInt64{}
	}
	if n < 1 {
		n = 1
	}
	if n > 10 {
		n = 10
	}
	return sql.NullInt64{Valid: true, Int64: int64(n)}
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

func toNullString(val string) sql.NullString {
	val = strings.TrimSpace(val)
	if val == "" {
		return sql.NullString{}
	}
	return sql.NullString{Valid: true, String: val}
}

func toNullFloat(val float64) sql.NullFloat64 {
	if val <= 0 {
		return sql.NullFloat64{}
	}
	return sql.NullFloat64{Valid: true, Float64: val}
}

func toNullInt(val int) sql.NullInt64 {
	if val <= 0 {
		return sql.NullInt64{}
	}
	return sql.NullInt64{Valid: true, Int64: int64(val)}
}

func nullStringPtr(val sql.NullString) *string {
	if !val.Valid {
		return nil
	}
	value := val.String
	return &value
}

func nullInt64Ptr(val sql.NullInt64) *int64 {
	if !val.Valid {
		return nil
	}
	value := val.Int64
	return &value
}

func nullFloat64Ptr(val sql.NullFloat64) *float64 {
	if !val.Valid {
		return nil
	}
	value := val.Float64
	return &value
}

func formatScore(val float64) string {
	if val <= 0 {
		return ""
	}
	return strconv.FormatFloat(val, 'f', 1, 64)
}

func formatVotes(val any) string {
	switch v := val.(type) {
	case int:
		if v <= 0 {
			return ""
		}
		return strconv.Itoa(v)
	case int64:
		if v <= 0 {
			return ""
		}
		return strconv.FormatInt(v, 10)
	default:
		return ""
	}
}

func imdbURL(id sql.NullString) string {
	if !id.Valid || strings.TrimSpace(id.String) == "" {
		return ""
	}
	return "https://www.imdb.com/title/" + strings.TrimSpace(id.String) + "/"
}
