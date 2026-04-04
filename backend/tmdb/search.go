package tmdb

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

func (c *Client) SearchPage(ctx context.Context, query, mediaType string, page int) (SearchPage, error) {
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
