package tmdb

import (
	"context"
	"fmt"
)

// RefreshSeason is the same request as FetchSeason. Client holds no cache, so
// only CachedClient has to tell the two apart.
func (c *Client) RefreshSeason(ctx context.Context, showID int64, seasonNumber int) (Season, error) {
	return c.FetchSeason(ctx, showID, seasonNumber)
}

func (c *Client) FetchSeason(ctx context.Context, showID int64, seasonNumber int) (Season, error) {
	endpoint := fmt.Sprintf("%s/tv/%d/season/%d", c.baseURL, showID, seasonNumber)

	var payload seasonResponse
	if err := c.doJSON(ctx, endpoint, &payload); err != nil {
		return Season{}, err
	}

	season := Season{Episodes: make([]Episode, 0, len(payload.Episodes))}

	for _, ep := range payload.Episodes {
		season.Episodes = append(season.Episodes, Episode{
			SeasonNumber:  payload.SeasonNumber,
			EpisodeNumber: ep.EpisodeNumber,
			Title:         ep.Name,
			AirDate:       ep.AirDate,
			Runtime:       ep.Runtime,
		})
	}

	return season, nil
}
