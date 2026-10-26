package handlers

import (
	"cmp"
	"context"
	"log/slog"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"

	"golang.org/x/sync/errgroup"

	"github.com/handsomefox/paired-ratings/backend/gen/pb"
	"github.com/handsomefox/paired-ratings/backend/logger"
	"github.com/handsomefox/paired-ratings/backend/store"
	"github.com/handsomefox/paired-ratings/backend/tmdb"
)

const (
	// searchPageSize matches TMDB's page size, so a plain search maps one
	// page to one TMDB page.
	searchPageSize = 20
	// maxScanPages bounds the TMDB pages one filtered or merged search reads.
	// Matches past that window are not reachable.
	maxScanPages    = 10
	scanConcurrency = 4
)

type searchSort string

const (
	sortRelevance  searchSort = "relevance"
	sortRating     searchSort = "rating"
	sortVotes      searchSort = "votes"
	sortYear       searchSort = "year"
	sortTitle      searchSort = "title"
	sortPopularity searchSort = "popularity"
)

type searchFilters struct {
	// MediaType is "movie", "tv", or empty for both.
	MediaType string
	YearFrom  *int
	YearTo    *int
	MinRating *float64
	MinVotes  *int
	GenreIDs  []int
	// GenreMatchAny matches a title with any listed genre instead of all.
	GenreMatchAny bool
	// Genres is the genre filter in TMDB's with_genres syntax.
	Genres           string
	OriginCountry    string
	OriginalLanguage string
	Sort             searchSort
	Page             int
}

type searchPage struct {
	Results      []tmdb.SearchResult
	Page         int
	TotalPages   int
	TotalResults int
}

func (h *Handler) getSearch(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()
	query := r.URL.Query()
	text := strings.TrimSpace(query.Get("q"))
	f := parseSearchFilters(query)

	var page searchPage
	var err error
	switch {
	case text != "":
		if f.MediaType == "" {
			return badRequest("media_type required")
		}
		page, err = h.searchText(ctx, text, &f)
	case f.MediaType != "" || f.narrows():
		page, err = h.discover(ctx, &f)
	default:
		// Nothing to look for yet.
		page = searchPage{Page: f.Page}
	}
	if err != nil {
		return badGateway(err)
	}

	results, err := h.toPBSearchResults(ctx, page.Results)
	if err != nil {
		return err
	}
	writeJSON(w, http.StatusOK, &pb.SearchResponse{
		Results:      results,
		Page:         clampInt32(page.Page),
		TotalPages:   clampInt32(page.TotalPages),
		TotalResults: clampInt32(page.TotalResults),
	})
	return nil
}

// searchText runs a title search. TMDB's search applies none of the filters,
// so a filtered or re-sorted search reads a window of pages and filters it here.
func (h *Handler) searchText(ctx context.Context, text string, f *searchFilters) (searchPage, error) {
	fetch := func(ctx context.Context, page int) (tmdb.SearchPage, error) {
		return h.tmdb.SearchPage(ctx, text, f.MediaType, page)
	}
	if !f.narrows() && f.Sort == sortRelevance {
		p, err := fetch(ctx, f.Page)
		return searchPage{Results: p.Results, Page: f.Page, TotalPages: p.TotalPages, TotalResults: p.TotalResults}, err
	}

	items, err := scan(ctx, fetch, maxScanPages)
	if err != nil {
		return searchPage{}, err
	}
	items = slices.DeleteFunc(items, func(item tmdb.SearchResult) bool { return !f.matches(&item) })
	sortResults(items, f.Sort)
	return paginate(items, f.Page), nil
}

// discover browses by filter. TMDB filters and sorts one media type itself.
// Both types read a window of each, merged and sorted here.
func (h *Handler) discover(ctx context.Context, f *searchFilters) (searchPage, error) {
	filters := tmdb.DiscoverFilters{
		YearFrom:         f.YearFrom,
		YearTo:           f.YearTo,
		MinRating:        f.MinRating,
		MinVotes:         f.MinVotes,
		Genres:           f.Genres,
		OriginCountry:    f.OriginCountry,
		OriginalLanguage: f.OriginalLanguage,
	}

	if f.MediaType != "" {
		filters.Sort = tmdbSort(f.Sort, f.MediaType)
		p, err := h.tmdb.DiscoverPage(ctx, f.MediaType, &filters, f.Page)
		return searchPage{Results: p.Results, Page: f.Page, TotalPages: p.TotalPages, TotalResults: p.TotalResults}, err
	}

	var items []tmdb.SearchResult
	for _, mediaType := range []string{"movie", "tv"} {
		typed := filters
		typed.Sort = tmdbSort(f.Sort, mediaType)
		found, err := scan(ctx, func(ctx context.Context, page int) (tmdb.SearchPage, error) {
			return h.tmdb.DiscoverPage(ctx, mediaType, &typed, page)
		}, maxScanPages/2)
		if err != nil {
			return searchPage{}, err
		}
		items = append(items, found...)
	}

	sort := f.Sort
	if sort == sortRelevance {
		sort = sortPopularity
	}
	sortResults(items, sort)
	return paginate(items, f.Page), nil
}

// scan reads TMDB pages 1 to maxPages, or fewer if TMDB has fewer, and returns
// their results in order in a new slice.
func scan(ctx context.Context, fetch func(ctx context.Context, page int) (tmdb.SearchPage, error), maxPages int) ([]tmdb.SearchResult, error) {
	first, err := fetch(ctx, 1)
	if err != nil {
		return nil, err
	}
	pages := make([][]tmdb.SearchResult, min(first.TotalPages, maxPages))
	if len(pages) == 0 {
		return nil, nil
	}
	pages[0] = first.Results

	g, ctx := errgroup.WithContext(ctx)
	g.SetLimit(scanConcurrency)
	for i := 1; i < len(pages); i++ {
		g.Go(func() error {
			p, err := fetch(ctx, i+1)
			pages[i] = p.Results
			return err
		})
	}
	if err := g.Wait(); err != nil {
		return nil, err
	}
	return slices.Concat(pages...), nil
}

func paginate(items []tmdb.SearchResult, page int) searchPage {
	offset := min((page-1)*searchPageSize, len(items))
	end := min(offset+searchPageSize, len(items))
	return searchPage{
		Results:      items[offset:end],
		Page:         page,
		TotalPages:   (len(items) + searchPageSize - 1) / searchPageSize,
		TotalResults: len(items),
	}
}

func parseSearchFilters(q url.Values) searchFilters {
	f := searchFilters{
		OriginCountry:    strings.ToUpper(strings.TrimSpace(q.Get("origin_country"))),
		OriginalLanguage: strings.ToLower(strings.TrimSpace(q.Get("original_language"))),
		Sort:             sortRelevance,
		Page:             1,
	}

	if mediaType := strings.TrimSpace(q.Get("media_type")); store.MediaType(mediaType).Valid() {
		f.MediaType = mediaType
	}
	switch sort := searchSort(strings.TrimSpace(q.Get("sort"))); sort {
	case sortRating, sortVotes, sortYear, sortTitle:
		f.Sort = sort
	case sortRelevance, sortPopularity:
		// Relevance is the default. Popularity only orders merged discover
		// results, so a client cannot ask for it.
	}
	if page, err := strconv.Atoi(q.Get("page")); err == nil && page > 1 {
		f.Page = min(page, tmdb.MaxPage)
	}

	f.YearFrom = positiveInt(q.Get("year_from"))
	f.YearTo = positiveInt(q.Get("year_to"))
	f.MinVotes = positiveInt(q.Get("min_votes"))
	if v, err := strconv.ParseFloat(strings.TrimSpace(q.Get("min_rating")), 64); err == nil && v > 0 {
		f.MinRating = &v
	}
	f.GenreIDs, f.GenreMatchAny, f.Genres = parseGenreFilter(q.Get("genres"))
	return f
}

func positiveInt(s string) *int {
	v, err := strconv.Atoi(strings.TrimSpace(s))
	if err != nil || v <= 0 {
		return nil
	}
	return &v
}

// parseGenreFilter reads TMDB's with_genres syntax: "1,2" needs every genre
// and "1|2" any of them.
func parseGenreFilter(raw string) (ids []int, matchAny bool, normalized string) {
	separator := ","
	if strings.Contains(raw, "|") {
		matchAny, separator = true, "|"
	}

	var parts []string
	for part := range strings.SplitSeq(raw, separator) {
		if id, err := strconv.Atoi(strings.TrimSpace(part)); err == nil && id > 0 {
			ids = append(ids, id)
			parts = append(parts, strconv.Itoa(id))
		}
	}
	if len(ids) == 0 {
		return nil, false, ""
	}
	return ids, matchAny, strings.Join(parts, separator)
}

// narrows reports a filter beyond the media type and the sort.
func (f *searchFilters) narrows() bool {
	return f.YearFrom != nil || f.YearTo != nil || f.MinRating != nil || f.MinVotes != nil ||
		len(f.GenreIDs) > 0 || f.OriginCountry != "" || f.OriginalLanguage != ""
}

func (f *searchFilters) matches(item *tmdb.SearchResult) bool {
	if f.MediaType != "" && item.MediaType != f.MediaType {
		return false
	}
	if f.MinRating != nil && item.VoteAverage < *f.MinRating {
		return false
	}
	if f.MinVotes != nil && item.VoteCount < *f.MinVotes {
		return false
	}
	if f.OriginalLanguage != "" && !strings.EqualFold(item.OriginalLanguage, f.OriginalLanguage) {
		return false
	}
	if f.OriginCountry != "" && !slices.ContainsFunc(item.OriginCountry, func(code string) bool {
		return strings.EqualFold(code, f.OriginCountry)
	}) {
		return false
	}
	if len(f.GenreIDs) > 0 && !matchesGenres(item.GenreIDs, f.GenreIDs, f.GenreMatchAny) {
		return false
	}
	if f.YearFrom != nil || f.YearTo != nil {
		year := tmdb.ParseYear(item.Year)
		if year == nil ||
			(f.YearFrom != nil && *year < *f.YearFrom) ||
			(f.YearTo != nil && *year > *f.YearTo) {
			return false
		}
	}
	return true
}

func matchesGenres(itemIDs, filterIDs []int, matchAny bool) bool {
	has := func(id int) bool { return slices.Contains(itemIDs, id) }
	if matchAny {
		return slices.ContainsFunc(filterIDs, has)
	}
	for _, id := range filterIDs {
		if !has(id) {
			return false
		}
	}
	return true
}

// sortResults orders items in place. Relevance keeps TMDB's order.
func sortResults(items []tmdb.SearchResult, sort searchSort) {
	year := func(r *tmdb.SearchResult) int {
		if y := tmdb.ParseYear(r.Year); y != nil {
			return *y
		}
		return 0
	}
	var compare func(a, b *tmdb.SearchResult) int
	switch sort {
	case sortRating:
		compare = func(a, b *tmdb.SearchResult) int {
			return cmp.Or(cmp.Compare(b.VoteAverage, a.VoteAverage), cmp.Compare(b.VoteCount, a.VoteCount))
		}
	case sortVotes:
		compare = func(a, b *tmdb.SearchResult) int {
			return cmp.Or(cmp.Compare(b.VoteCount, a.VoteCount), cmp.Compare(b.VoteAverage, a.VoteAverage))
		}
	case sortYear:
		compare = func(a, b *tmdb.SearchResult) int { return cmp.Compare(year(b), year(a)) }
	case sortTitle:
		compare = func(a, b *tmdb.SearchResult) int {
			return strings.Compare(strings.ToLower(a.Title), strings.ToLower(b.Title))
		}
	case sortPopularity:
		compare = func(a, b *tmdb.SearchResult) int { return cmp.Compare(b.Popularity, a.Popularity) }
	default:
		return
	}
	slices.SortStableFunc(items, func(a, b tmdb.SearchResult) int {
		return cmp.Or(compare(&a, &b), strings.Compare(a.Title, b.Title))
	})
}

func tmdbSort(sort searchSort, mediaType string) string {
	switch sort {
	case sortRating:
		return "vote_average.desc"
	case sortVotes:
		return "vote_count.desc"
	case sortYear:
		if mediaType == "tv" {
			return "first_air_date.desc"
		}
		return "primary_release_date.desc"
	case sortTitle:
		if mediaType == "tv" {
			return "original_name.asc"
		}
		return "original_title.asc"
	default:
		return "popularity.desc"
	}
}

// toPBSearchResults adds each item's library id and genre names.
func (h *Handler) toPBSearchResults(ctx context.Context, items []tmdb.SearchResult) ([]*pb.SearchResult, error) {
	refs := make([]store.TMDBRef, 0, len(items))
	for i := range items {
		refs = append(refs, store.TMDBRef{ID: items[i].ID, MediaType: store.MediaType(items[i].MediaType)})
	}
	library, err := h.store.LibraryIDs(ctx, refs)
	if err != nil {
		return nil, err
	}
	genreNames := h.genreNames(ctx)

	out := make([]*pb.SearchResult, 0, len(items))
	for i := range items {
		item := &items[i]
		var libraryID *int64
		if id, ok := library[refs[i]]; ok {
			libraryID = &id
		}
		var genres []string
		for _, id := range item.GenreIDs {
			if name, ok := genreNames[item.MediaType][id]; ok {
				genres = append(genres, name)
			}
		}
		out = append(out, &pb.SearchResult{
			Id:               item.ID,
			MediaType:        item.MediaType,
			Title:            item.Title,
			Year:             item.Year,
			PosterPath:       item.PosterPath,
			Overview:         item.Overview,
			VoteAverage:      item.VoteAverage,
			VoteCount:        clampInt32(item.VoteCount),
			LibraryId:        libraryID,
			Genres:           genres,
			OriginalLanguage: item.OriginalLanguage,
		})
	}
	return out, nil
}

// genreNames maps media type and genre id to the genre name. Results only
// lose their genre names if TMDB is unavailable.
func (h *Handler) genreNames(ctx context.Context) map[string]map[int]string {
	out := make(map[string]map[int]string, 2)
	for _, mediaType := range []string{"movie", "tv"} {
		genres, err := h.tmdb.FetchGenres(ctx, mediaType)
		if err != nil {
			slog.Warn("search: fetch genres failed", logger.Error(err))
			continue
		}
		names := make(map[int]string, len(genres))
		for _, g := range genres {
			names[g.ID] = g.Name
		}
		out[mediaType] = names
	}
	return out
}

func (h *Handler) getSearchGenres(w http.ResponseWriter, r *http.Request) error {
	movie, err := h.tmdb.FetchGenres(r.Context(), "movie")
	if err != nil {
		return badGateway(err)
	}
	tv, err := h.tmdb.FetchGenres(r.Context(), "tv")
	if err != nil {
		return badGateway(err)
	}
	toPB := func(genres []tmdb.Genre) []*pb.Genre {
		out := make([]*pb.Genre, 0, len(genres))
		for _, g := range genres {
			out = append(out, &pb.Genre{Id: clampInt32(g.ID), Name: g.Name})
		}
		return out
	}
	writeJSON(w, http.StatusOK, &pb.SearchGenresResponse{MovieGenres: toPB(movie), TvGenres: toPB(tv)})
	return nil
}

func (h *Handler) getSearchCountries(w http.ResponseWriter, r *http.Request) error {
	countries, err := h.tmdb.FetchCountries(r.Context())
	if err != nil {
		return badGateway(err)
	}
	out := make([]*pb.Country, 0, len(countries))
	for _, c := range countries {
		out = append(out, &pb.Country{Code: c.Code, Name: c.Name})
	}
	writeJSON(w, http.StatusOK, &pb.SearchCountriesResponse{Countries: out})
	return nil
}

func (h *Handler) getSearchLanguages(w http.ResponseWriter, r *http.Request) error {
	languages, err := h.tmdb.FetchLanguages(r.Context())
	if err != nil {
		return badGateway(err)
	}
	out := make([]*pb.Language, 0, len(languages))
	for _, l := range languages {
		out = append(out, &pb.Language{Code: l.Code, Name: l.Name})
	}
	writeJSON(w, http.StatusOK, &pb.SearchLanguagesResponse{Languages: out})
	return nil
}

func (h *Handler) getSearchResolve(w http.ResponseWriter, r *http.Request) error {
	query := r.URL.Query()
	tmdbID, err := strconv.ParseInt(strings.TrimSpace(query.Get("tmdb_id")), 10, 64)
	if err != nil || tmdbID <= 0 {
		return badRequest("invalid tmdb_id")
	}
	mediaType := strings.TrimSpace(query.Get("media_type"))
	if !store.MediaType(mediaType).Valid() {
		return badRequest("invalid media_type")
	}

	detail, err := h.tmdb.FetchDetails(r.Context(), tmdbID, mediaType)
	if err != nil {
		return badGateway(err)
	}
	writeJSON(w, http.StatusOK, &pb.SearchResolveResponse{
		ImdbUrl: imdbURL(optional(detail.IMDbID)),
		TmdbUrl: new(tmdbURL(mediaType, tmdbID)),
	})
	return nil
}
