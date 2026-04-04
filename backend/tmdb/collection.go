package tmdb

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
)

func (c *Client) FetchCollection(ctx context.Context, collectionID int64) ([]SearchResult, error) {
	values := url.Values{}
	c.maybeSetAPIKey(values)

	endpoint := fmt.Sprintf("%s/collection/%d?%s", baseURL, collectionID, values.Encode())

	var payload collectionResponse
	if err := c.doJSON(ctx, http.MethodGet, endpoint, &payload); err != nil {
		return nil, err
	}

	results := make([]SearchResult, 0, len(payload.Parts))
	for _, p := range payload.Parts {
		results = append(results, SearchResult{
			MediaType:   "movie",
			ID:          p.ID,
			Title:       p.Title,
			Year:        yearFromDate(p.ReleaseDate),
			PosterPath:  p.PosterPath,
			Overview:    p.Overview,
			VoteAverage: p.VoteAverage,
			VoteCount:   p.VoteCount,
		})
	}
	return results, nil
}

func (c *Client) FetchRecommendations(ctx context.Context, id int64, mediaType string) ([]SearchResult, error) {
	values := url.Values{}
	c.maybeSetAPIKey(values)

	endpoint := fmt.Sprintf("%s/%s/%d/recommendations?%s", baseURL, mediaType, id, values.Encode())

	var payload recommendationsResponse
	if err := c.doJSON(ctx, http.MethodGet, endpoint, &payload); err != nil {
		return nil, err
	}

	results := make([]SearchResult, 0, len(payload.Results))
	for i := range payload.Results {
		r := &payload.Results[i]
		title := r.Title
		year := yearFromDate(r.ReleaseDate)
		if mediaType == "tv" {
			title = r.Name
			year = yearFromDate(r.FirstAirDate)
		}
		results = append(results, SearchResult{
			MediaType:        mediaType,
			ID:               r.ID,
			Title:            title,
			Year:             year,
			PosterPath:       r.PosterPath,
			Overview:         r.Overview,
			VoteAverage:      r.VoteAverage,
			VoteCount:        r.VoteCount,
			GenreIDs:         r.GenreIDs,
			OriginalLanguage: r.OriginalLanguage,
		})
	}
	return results, nil
}
