package handlers

import (
	"cmp"
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/handsomefox/paired-ratings/backend/gen/pb"
	"github.com/handsomefox/paired-ratings/backend/logger"
	"github.com/handsomefox/paired-ratings/backend/store"
	"github.com/handsomefox/paired-ratings/backend/tmdb"
)

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
		slog.Warn("search resolve failed", logger.Error(err))
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

	pageData, err := h.searchTMDB(ctx, query, &filters)
	if err != nil {
		return &Error{Status: http.StatusBadGateway, Message: err.Error()}
	}

	inLibrary, err := h.lookupInLibrary(ctx, pageData.Results)
	if err != nil {
		return internal(err)
	}

	movieGenres, tvGenres := h.genreMaps(ctx)

	results := make([]*pb.SearchResult, 0, len(pageData.Results))
	for i := range pageData.Results {
		item := &pageData.Results[i]
		results = append(results, &pb.SearchResult{
			Id:               item.ID,
			MediaType:        item.MediaType,
			Title:            item.Title,
			Year:             item.Year,
			PosterPath:       item.PosterPath,
			Overview:         item.Overview,
			VoteAverage:      item.VoteAverage,
			VoteCount:        int32(item.VoteCount),
			InLibrary:        inLibrary[store.TMDBRef{ID: item.ID, MediaType: item.MediaType}],
			Genres:           genreNamesFor(*item, movieGenres, tvGenres),
			OriginalLanguage: item.OriginalLanguage,
		})
	}

	writeJSON(w, http.StatusOK, &pb.SearchResponse{
		Results:      results,
		Page:         int32(pageData.Page),
		TotalPages:   int32(pageData.TotalPages),
		TotalResults: int32(pageData.TotalResults),
	})
	return nil
}

func (h *Handler) searchTMDB(ctx context.Context, query string, filters *searchFilters) (searchPage, error) {
	const perPage = 20
	const tmdbPageSize = 20

	if filters.Page < 1 {
		filters.Page = 1
	}

	if query != "" {
		mediaType := strings.TrimSpace(filters.MediaType)
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
	filters *searchFilters,
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
		offset %= remotePageSize
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

func (f *searchFilters) isEmpty() bool {
	return f.MediaType == "all" &&
		f.YearFrom == nil &&
		f.YearTo == nil &&
		f.MinRating == nil &&
		f.MinVotes == nil &&
		len(f.GenreIDs) == 0 &&
		f.OriginCountry == "" &&
		f.OriginalLanguage == ""
}

func applySearchFilters(items []tmdb.SearchResult, filters *searchFilters) []tmdb.SearchResult {
	if len(items) == 0 {
		return items
	}

	out := make([]tmdb.SearchResult, 0, len(items))
	for i := range items {
		item := &items[i]
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
		out = append(out, *item)
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

func matchesGenres(itemIDs, filterIDs []int, mode string) bool {
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
	end := min(offset+limit, len(items))
	return items[offset:end]
}

func (h *Handler) lookupInLibrary(ctx context.Context, items []tmdb.SearchResult) (map[store.TMDBRef]bool, error) {
	refs := make([]store.TMDBRef, 0, len(items))
	for i := range items {
		mediaType := strings.TrimSpace(items[i].MediaType)
		if items[i].ID == 0 || mediaType == "" {
			continue
		}
		refs = append(refs, store.TMDBRef{ID: items[i].ID, MediaType: mediaType})
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
