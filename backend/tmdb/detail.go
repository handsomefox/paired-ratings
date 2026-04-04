package tmdb

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

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
		TMDBID:         payload.ID,
		MediaType:      mediaType,
		PosterPath:     payload.PosterPath,
		Overview:       payload.Overview,
		Genres:         nil,
		OriginCountry:  nil,
		VoteAverage:    payload.VoteAverage,
		VoteCount:      payload.VoteCount,
		IMDbID:         payload.ExternalIDs.IMDbID,
		Year:           yearFromDate(payload.ReleaseDate),
		CollectionID:   payload.BelongsToCollection.ID,
		CollectionName: payload.BelongsToCollection.Name,
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
