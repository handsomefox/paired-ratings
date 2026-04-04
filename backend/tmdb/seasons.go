package tmdb

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
)

func (c *Client) FetchSeason(ctx context.Context, showID int64, seasonNumber int) (Season, error) {
	values := url.Values{}
	c.maybeSetAPIKey(values)

	endpoint := fmt.Sprintf("%s/tv/%d/season/%d?%s", baseURL, showID, seasonNumber, values.Encode())

	var payload seasonResponse
	if err := c.doJSON(ctx, http.MethodGet, endpoint, &payload); err != nil {
		return Season{}, err
	}

	season := Season{
		SeasonNumber: payload.SeasonNumber,
		Episodes:     make([]Episode, 0, len(payload.Episodes)),
	}

	for _, ep := range payload.Episodes {
		season.Episodes = append(season.Episodes, Episode{
			SeasonNumber:  payload.SeasonNumber,
			EpisodeNumber: ep.EpisodeNumber,
			Title:         ep.Name,
			Overview:      ep.Overview,
			AirDate:       ep.AirDate,
			Runtime:       ep.Runtime,
		})
	}

	return season, nil
}
