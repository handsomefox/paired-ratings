package tmdb

import (
	"context"
	"fmt"
)

func (c *Client) FetchCollection(ctx context.Context, collectionID int64) ([]SearchResult, error) {
	endpoint := fmt.Sprintf("%s/collection/%d", c.baseURL, collectionID)

	var payload collectionResponse
	if err := c.doJSON(ctx, endpoint, &payload); err != nil {
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
			Popularity:  p.Popularity,
		})
	}
	return results, nil
}

func (c *Client) FetchRecommendations(ctx context.Context, id int64, mediaType string) ([]SearchResult, error) {
	if !validMediaType(mediaType) {
		return nil, errMediaType
	}
	endpoint := fmt.Sprintf("%s/%s/%d/recommendations", c.baseURL, mediaType, id)

	var payload recommendationsResponse
	if err := c.doJSON(ctx, endpoint, &payload); err != nil {
		return nil, err
	}

	results := make([]SearchResult, 0, len(payload.Results))
	for i := range payload.Results {
		r := &payload.Results[i]
		// Use the media_type from the response; fall back to the requested type.
		mt := r.MediaType
		if mt == "" {
			mt = mediaType
		}
		var title, year string
		if mt == "tv" {
			title = r.Name
			year = yearFromDate(r.FirstAirDate)
		} else {
			title = r.Title
			year = yearFromDate(r.ReleaseDate)
		}
		results = append(results, SearchResult{
			MediaType:        mt,
			ID:               r.ID,
			Title:            title,
			Year:             year,
			PosterPath:       r.PosterPath,
			Overview:         r.Overview,
			VoteAverage:      r.VoteAverage,
			VoteCount:        r.VoteCount,
			Popularity:       r.Popularity,
			GenreIDs:         r.GenreIDs,
			OriginalLanguage: r.OriginalLanguage,
			OriginCountry:    r.OriginCountry,
		})
	}
	return results, nil
}
