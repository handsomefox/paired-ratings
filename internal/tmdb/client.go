// Package tmdb wraps the TMDB API for searching and fetching show details.
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

type Client struct {
	apiKey    string
	readToken string
	http      *http.Client
}

type SearchResult struct {
	ID          int64  `json:"id"`
	MediaType   string `json:"media_type"`
	Title       string
	Year        string
	PosterPath  string  `json:"poster_path"`
	Overview    string  `json:"overview"`
	VoteAverage float64 `json:"vote_average"`
	VoteCount   int     `json:"vote_count"`
}

type SearchPage struct {
	Results      []SearchResult
	Page         int
	TotalPages   int
	TotalResults int
}

type searchResponse struct {
	Page         int `json:"page"`
	TotalPages   int `json:"total_pages"`
	TotalResults int `json:"total_results"`
	Results      []struct {
		ID           int64   `json:"id"`
		MediaType    string  `json:"media_type"`
		Title        string  `json:"title"`
		Name         string  `json:"name"`
		ReleaseDate  string  `json:"release_date"`
		FirstAirDate string  `json:"first_air_date"`
		PosterPath   string  `json:"poster_path"`
		Overview     string  `json:"overview"`
		VoteAverage  float64 `json:"vote_average"`
		VoteCount    int     `json:"vote_count"`
	} `json:"results"`
}

type detailResponse struct {
	ID           int64   `json:"id"`
	Title        string  `json:"title"`
	Name         string  `json:"name"`
	ReleaseDate  string  `json:"release_date"`
	FirstAirDate string  `json:"first_air_date"`
	PosterPath   string  `json:"poster_path"`
	Overview     string  `json:"overview"`
	VoteAverage  float64 `json:"vote_average"`
	VoteCount    int     `json:"vote_count"`
	Genres       []struct {
		Name string `json:"name"`
	} `json:"genres"`
	ExternalIDs struct {
		IMDbID string `json:"imdb_id"`
	} `json:"external_ids"`
}

func New(apiKey, readToken string) *Client {
	if strings.TrimSpace(readToken) == "" && looksLikeJWT(apiKey) {
		readToken = apiKey
		apiKey = ""
	}
	return &Client{
		apiKey:    apiKey,
		readToken: readToken,
		http: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (c *Client) Search(query string) ([]SearchResult, error) {
	if strings.TrimSpace(query) == "" {
		return nil, nil
	}
	pageData, err := c.SearchPage(query, 1)
	if err != nil {
		return nil, err
	}
	return pageData.Results, nil
}

func (c *Client) SearchPage(query string, page int) (SearchPage, error) {
	if strings.TrimSpace(query) == "" {
		return SearchPage{}, nil
	}
	if page < 1 {
		page = 1
	}
	values := url.Values{}
	if c.apiKey != "" {
		values.Set("api_key", c.apiKey)
	}
	values.Set("query", query)
	values.Set("include_adult", "false")
	values.Set("page", strconv.Itoa(page))
	endpoint := "https://api.themoviedb.org/3/search/multi?" + values.Encode()
	return c.fetchSearch(endpoint, "")
}

func (c *Client) FetchDetails(id int64, mediaType string) (*Detail, error) {
	if mediaType != "movie" && mediaType != "tv" {
		return nil, errors.New("invalid media type")
	}
	values := url.Values{}
	if c.apiKey != "" {
		values.Set("api_key", c.apiKey)
	}
	values.Set("append_to_response", "external_ids")
	endpoint := fmt.Sprintf("https://api.themoviedb.org/3/%s/%d?%s", mediaType, id, values.Encode())

	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, endpoint, http.NoBody)
	if err != nil {
		return nil, err
	}
	c.applyAuth(req)
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		statusErr := fmt.Errorf("tmdb details failed: %s", resp.Status)
		if cerr := resp.Body.Close(); cerr != nil {
			return nil, errors.Join(statusErr, cerr)
		}
		return nil, statusErr
	}

	var payload detailResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		if cerr := resp.Body.Close(); cerr != nil {
			return nil, errors.Join(err, cerr)
		}
		return nil, err
	}
	if err := resp.Body.Close(); err != nil {
		return nil, err
	}

	detail := &Detail{
		TMDBID:      payload.ID,
		MediaType:   mediaType,
		PosterPath:  payload.PosterPath,
		Overview:    payload.Overview,
		Genres:      nil,
		VoteAverage: payload.VoteAverage,
		VoteCount:   payload.VoteCount,
		IMDbID:      payload.ExternalIDs.IMDbID,
		Year:        yearFromDate(payload.ReleaseDate),
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
	return detail, nil
}

type Detail struct {
	TMDBID      int64
	MediaType   string
	Title       string
	Year        string
	Genres      []string
	Overview    string
	PosterPath  string
	IMDbID      string
	VoteAverage float64
	VoteCount   int
}

type DiscoverFilters struct {
	YearFrom  *int
	YearTo    *int
	MinRating *float64
}

func yearFromDate(date string) string {
	if len(date) < 4 {
		return ""
	}
	return date[:4]
}

func (c *Client) Discover(mediaType string, filters DiscoverFilters) ([]SearchResult, error) {
	pageData, err := c.DiscoverPage(mediaType, filters, 1)
	if err != nil {
		return nil, err
	}
	return pageData.Results, nil
}

func (c *Client) DiscoverPage(mediaType string, filters DiscoverFilters, page int) (SearchPage, error) {
	if mediaType != "movie" && mediaType != "tv" {
		return SearchPage{}, errors.New("invalid media type")
	}
	if page < 1 {
		page = 1
	}
	values := url.Values{}
	if c.apiKey != "" {
		values.Set("api_key", c.apiKey)
	}
	values.Set("include_adult", "false")
	values.Set("sort_by", "popularity.desc")
	if filters.MinRating != nil {
		values.Set("vote_average.gte", strconv.FormatFloat(*filters.MinRating, 'f', 1, 64))
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
	values.Set("page", strconv.Itoa(page))
	endpoint := fmt.Sprintf("https://api.themoviedb.org/3/discover/%s?%s", mediaType, values.Encode())
	return c.fetchSearch(endpoint, mediaType)
}

func (c *Client) fetchSearch(endpoint, mediaTypeOverride string) (SearchPage, error) {
	req, err := http.NewRequestWithContext(context.Background(), http.MethodGet, endpoint, http.NoBody)
	if err != nil {
		return SearchPage{}, err
	}
	c.applyAuth(req)
	resp, err := c.http.Do(req)
	if err != nil {
		return SearchPage{}, err
	}
	if resp.StatusCode >= 400 {
		statusErr := fmt.Errorf("tmdb search failed: %s", resp.Status)
		if cerr := resp.Body.Close(); cerr != nil {
			return SearchPage{}, errors.Join(statusErr, cerr)
		}
		return SearchPage{}, statusErr
	}

	var payload searchResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		if cerr := resp.Body.Close(); cerr != nil {
			return SearchPage{}, errors.Join(err, cerr)
		}
		return SearchPage{}, err
	}
	if err := resp.Body.Close(); err != nil {
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
			ID:          r.ID,
			MediaType:   mediaType,
			PosterPath:  r.PosterPath,
			Overview:    r.Overview,
			VoteAverage: r.VoteAverage,
			VoteCount:   r.VoteCount,
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
		TotalPages:   payload.TotalPages,
		TotalResults: payload.TotalResults,
	}, nil
}

func (c *Client) applyAuth(req *http.Request) {
	if strings.TrimSpace(c.readToken) == "" {
		return
	}
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(c.readToken))
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
