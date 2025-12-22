// Package tmdb wraps TMDB API calls and response shaping.
package tmdb

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const baseURL = "https://api.themoviedb.org/3"

type Client struct {
	http      *http.Client
	apiKey    string
	readToken string
}

type SearchResult struct {
	MediaType        string   `json:"media_type"`
	Title            string   `json:"title"`
	Year             string   `json:"year"`
	PosterPath       string   `json:"poster_path"`
	Overview         string   `json:"overview"`
	ID               int64    `json:"id"`
	VoteAverage      float64  `json:"vote_average"`
	VoteCount        int      `json:"vote_count"`
	GenreIDs         []int    `json:"genre_ids"`
	OriginCountry    []string `json:"origin_country"`
	OriginalLanguage string   `json:"original_language"`
}

type SearchPage struct {
	Results      []SearchResult
	Page         int
	TotalPages   int
	TotalResults int
}

type searchResponse struct {
	Results []struct {
		MediaType        string   `json:"media_type"`
		Title            string   `json:"title"`
		Name             string   `json:"name"`
		ReleaseDate      string   `json:"release_date"`
		FirstAirDate     string   `json:"first_air_date"`
		PosterPath       string   `json:"poster_path"`
		Overview         string   `json:"overview"`
		ID               int64    `json:"id"`
		VoteAverage      float64  `json:"vote_average"`
		VoteCount        int      `json:"vote_count"`
		GenreIDs         []int    `json:"genre_ids"`
		OriginCountry    []string `json:"origin_country"`
		OriginalLanguage string   `json:"original_language"`
	} `json:"results"`
	Page         int `json:"page"`
	TotalPages   int `json:"total_pages"`
	TotalResults int `json:"total_results"`
}

type detailResponse struct {
	Title               string   `json:"title"`
	Name                string   `json:"name"`
	ReleaseDate         string   `json:"release_date"`
	FirstAirDate        string   `json:"first_air_date"`
	PosterPath          string   `json:"poster_path"`
	Overview            string   `json:"overview"`
	OriginCountry       []string `json:"origin_country"`
	ProductionCountries []struct {
		ISO3166_1 string `json:"iso_3166_1"`
	} `json:"production_countries"`
	ExternalIDs struct {
		IMDbID string `json:"imdb_id"`
	} `json:"external_ids"`
	Genres []struct {
		Name string `json:"name"`
	} `json:"genres"`
	ID          int64   `json:"id"`
	VoteAverage float64 `json:"vote_average"`
	VoteCount   int     `json:"vote_count"`
}

func New(apiKey, readToken string) *Client {
	if strings.TrimSpace(readToken) == "" && looksLikeJWT(apiKey) {
		readToken = apiKey
		apiKey = ""
	}
	return &Client{
		apiKey:    strings.TrimSpace(apiKey),
		readToken: strings.TrimSpace(readToken),
		http: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

type Detail struct {
	MediaType     string
	Title         string
	Year          string
	Overview      string
	PosterPath    string
	IMDbID        string
	Genres        []string
	OriginCountry []string
	TMDBID        int64
	VoteAverage   float64
	VoteCount     int
}

type DiscoverFilters struct {
	YearFrom         *int
	YearTo           *int
	MinRating        *float64
	MinVotes         *int
	Genres           string
	Sort             string
	OriginCountry    string
	OriginalLanguage string
}

type Genre struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

type genreResponse struct {
	Genres []Genre `json:"genres"`
}

type Country struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

type countryResponse []struct {
	ISO3166_1   string `json:"iso_3166_1"`
	EnglishName string `json:"english_name"`
}

type Language struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

type languageResponse []struct {
	ISO639_1    string `json:"iso_639_1"`
	EnglishName string `json:"english_name"`
	Name        string `json:"name"`
}

func (c *Client) SearchPage(ctx context.Context, query string, mediaType string, page int) (SearchPage, error) {
	query = strings.TrimSpace(query)
	if query == "" {
		return SearchPage{}, nil
	}

	mediaType = strings.TrimSpace(mediaType)
	if mediaType != "movie" && mediaType != "tv" {
		return SearchPage{}, errors.New("invalid media type")
	}

	if page < 1 {
		page = 1
	}

	values := url.Values{}
	c.maybeSetAPIKey(values)
	values.Set("query", query)
	values.Set("include_adult", "false")
	values.Set("page", strconv.Itoa(page))

	endpoint := baseURL + "/search/" + mediaType + "?" + values.Encode()
	return c.fetchSearch(ctx, endpoint, mediaType)
}

func (c *Client) DiscoverPage(ctx context.Context, mediaType string, filters DiscoverFilters, page int) (SearchPage, error) {
	if mediaType != "movie" && mediaType != "tv" {
		return SearchPage{}, errors.New("invalid media type")
	}
	if page < 1 {
		page = 1
	}

	values := url.Values{}
	c.maybeSetAPIKey(values)
	values.Set("include_adult", "false")
	sortBy := strings.TrimSpace(filters.Sort)
	if sortBy == "" {
		sortBy = "popularity.desc"
	}
	values.Set("sort_by", sortBy)
	values.Set("page", strconv.Itoa(page))

	if filters.MinRating != nil {
		values.Set("vote_average.gte", strconv.FormatFloat(*filters.MinRating, 'f', 1, 64))
	}
	if filters.MinVotes != nil && *filters.MinVotes > 0 {
		values.Set("vote_count.gte", strconv.Itoa(*filters.MinVotes))
	}
	if strings.TrimSpace(filters.Genres) != "" {
		values.Set("with_genres", strings.TrimSpace(filters.Genres))
	}
	if strings.TrimSpace(filters.OriginCountry) != "" {
		values.Set("with_origin_country", strings.TrimSpace(filters.OriginCountry))
	}
	if strings.TrimSpace(filters.OriginalLanguage) != "" {
		values.Set("with_original_language", strings.TrimSpace(filters.OriginalLanguage))
	}

	dateFromKey := "primary_release_date.gte"
	dateToKey := "primary_release_date.lte"
	if mediaType == "tv" {
		dateFromKey = "first_air_date.gte"
		dateToKey = "first_air_date.lte"
	}

	if filters.YearFrom != nil {
		values.Set(dateFromKey, fmt.Sprintf("%04d-01-01", *filters.YearFrom))
	}
	if filters.YearTo != nil {
		values.Set(dateToKey, fmt.Sprintf("%04d-12-31", *filters.YearTo))
	}

	endpoint := baseURL + "/discover/" + mediaType + "?" + values.Encode()
	return c.fetchSearch(ctx, endpoint, mediaType)
}

func (c *Client) FetchGenres(ctx context.Context, mediaType string) ([]Genre, error) {
	if mediaType != "movie" && mediaType != "tv" {
		return nil, errors.New("invalid media type")
	}

	values := url.Values{}
	c.maybeSetAPIKey(values)
	endpoint := baseURL + "/genre/" + mediaType + "/list?" + values.Encode()

	var payload genreResponse
	if err := c.doJSON(ctx, http.MethodGet, endpoint, &payload); err != nil {
		return nil, err
	}
	return payload.Genres, nil
}

func (c *Client) FetchCountries(ctx context.Context) ([]Country, error) {
	values := url.Values{}
	c.maybeSetAPIKey(values)
	endpoint := baseURL + "/configuration/countries?" + values.Encode()

	var payload countryResponse
	if err := c.doJSON(ctx, http.MethodGet, endpoint, &payload); err != nil {
		return nil, err
	}

	out := make([]Country, 0, len(payload))
	for _, item := range payload {
		code := strings.TrimSpace(item.ISO3166_1)
		name := strings.TrimSpace(item.EnglishName)
		if code == "" {
			continue
		}
		out = append(out, Country{Code: code, Name: name})
	}
	return out, nil
}

func (c *Client) FetchLanguages(ctx context.Context) ([]Language, error) {
	values := url.Values{}
	c.maybeSetAPIKey(values)
	endpoint := baseURL + "/configuration/languages?" + values.Encode()

	var payload languageResponse
	if err := c.doJSON(ctx, http.MethodGet, endpoint, &payload); err != nil {
		return nil, err
	}

	out := make([]Language, 0, len(payload))
	for _, item := range payload {
		code := strings.TrimSpace(item.ISO639_1)
		name := strings.TrimSpace(item.EnglishName)
		if name == "" {
			name = strings.TrimSpace(item.Name)
		}
		if code == "" {
			continue
		}
		out = append(out, Language{Code: code, Name: name})
	}
	return out, nil
}

func (c *Client) FetchDetails(ctx context.Context, id int64, mediaType string) (*Detail, error) {
	if mediaType != "movie" && mediaType != "tv" {
		return nil, errors.New("invalid media type")
	}

	values := url.Values{}
	c.maybeSetAPIKey(values)
	values.Set("append_to_response", "external_ids")

	endpoint := fmt.Sprintf("%s/%s/%d?%s", baseURL, mediaType, id, values.Encode())

	var payload detailResponse
	if err := c.doJSON(ctx, http.MethodGet, endpoint, &payload); err != nil {
		return nil, err
	}

	detail := &Detail{
		TMDBID:        payload.ID,
		MediaType:     mediaType,
		PosterPath:    payload.PosterPath,
		Overview:      payload.Overview,
		Genres:        nil,
		OriginCountry: nil,
		VoteAverage:   payload.VoteAverage,
		VoteCount:     payload.VoteCount,
		IMDbID:        payload.ExternalIDs.IMDbID,
		Year:          yearFromDate(payload.ReleaseDate),
	}

	if mediaType == "tv" {
		detail.Title = payload.Name
		detail.Year = yearFromDate(payload.FirstAirDate)
	} else {
		detail.Title = payload.Title
	}

	for _, g := range payload.Genres {
		if strings.TrimSpace(g.Name) == "" {
			continue
		}
		detail.Genres = append(detail.Genres, g.Name)
	}

	if len(payload.OriginCountry) > 0 {
		for _, code := range payload.OriginCountry {
			code = strings.TrimSpace(code)
			if code == "" {
				continue
			}
			detail.OriginCountry = append(detail.OriginCountry, code)
		}
	} else if len(payload.ProductionCountries) > 0 {
		for _, country := range payload.ProductionCountries {
			code := strings.TrimSpace(country.ISO3166_1)
			if code == "" {
				continue
			}
			detail.OriginCountry = append(detail.OriginCountry, code)
		}
	}

	return detail, nil
}

/* internals */

func (c *Client) fetchSearch(ctx context.Context, endpoint, mediaTypeOverride string) (SearchPage, error) {
	var payload searchResponse
	if err := c.doJSON(ctx, http.MethodGet, endpoint, &payload); err != nil {
		return SearchPage{}, err
	}

	out := make([]SearchResult, 0, len(payload.Results))
	for i := range payload.Results {
		r := payload.Results[i]

		mediaType := r.MediaType
		if mediaTypeOverride != "" {
			mediaType = mediaTypeOverride
		}
		if mediaType != "movie" && mediaType != "tv" {
			continue
		}

		res := SearchResult{
			ID:               r.ID,
			MediaType:        mediaType,
			PosterPath:       r.PosterPath,
			Overview:         r.Overview,
			VoteAverage:      r.VoteAverage,
			VoteCount:        r.VoteCount,
			GenreIDs:         r.GenreIDs,
			OriginCountry:    r.OriginCountry,
			OriginalLanguage: r.OriginalLanguage,
		}

		if mediaType == "movie" {
			res.Title = r.Title
			res.Year = yearFromDate(r.ReleaseDate)
		} else {
			res.Title = r.Name
			res.Year = yearFromDate(r.FirstAirDate)
		}
		out = append(out, res)
	}

	return SearchPage{
		Results:      out,
		Page:         payload.Page,
		TotalPages:   min(payload.TotalPages, 500),
		TotalResults: payload.TotalResults,
	}, nil
}

func (c *Client) doJSON(ctx context.Context, method, endpoint string, dst any) error {
	req, err := http.NewRequestWithContext(ctx, method, endpoint, http.NoBody)
	if err != nil {
		return err
	}

	c.applyAuth(req)

	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer func() {
		if cerr := resp.Body.Close(); cerr != nil {
			// best-effort close; request already completed
		}
	}()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("tmdb request failed: %s", resp.Status)
	}

	return json.NewDecoder(resp.Body).Decode(dst)
}

func (c *Client) maybeSetAPIKey(values url.Values) {
	if c.apiKey != "" {
		values.Set("api_key", c.apiKey)
	}
}

func (c *Client) applyAuth(req *http.Request) {
	if strings.TrimSpace(c.readToken) == "" {
		return
	}
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(c.readToken))
}

func yearFromDate(date string) string {
	if len(date) < 4 {
		return ""
	}
	return date[:4]
}

func looksLikeJWT(token string) bool {
	parts := strings.Split(strings.TrimSpace(token), ".")
	return len(parts) == 3 && len(token) > 80
}

func ParseYear(year string) *int {
	year = strings.TrimSpace(year)
	if year == "" {
		return nil
	}
	val, err := strconv.Atoi(year)
	if err != nil {
		return nil
	}
	return &val
}
