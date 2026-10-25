package store

import (
	"context"

	"github.com/handsomefox/paired-ratings/backend/gen/db"
)

func (s *Store) ListEpisodes(ctx context.Context, showID int64) ([]Episode, error) {
	rows, err := s.q.ListEpisodes(ctx, showID)
	if err != nil {
		return nil, err
	}
	out := make([]Episode, 0, len(rows))
	for _, r := range rows {
		out = append(out, Episode{
			ID:            r.ID,
			ShowID:        r.ShowID,
			SeasonNumber:  r.SeasonNumber,
			EpisodeNumber: r.EpisodeNumber,
			Title:         r.Title,
			AirDate:       r.AirDate,
			Runtime:       r.Runtime,
			Watched:       r.Watched != 0,
		})
	}
	return out, nil
}

// SyncEpisodes stores TMDB episode metadata for a show. Episodes it already
// has keep their watched flag.
func (s *Store) SyncEpisodes(ctx context.Context, showID int64, episodes []EpisodeMetadata) error {
	if len(episodes) == 0 {
		return nil
	}
	now := nowUTC()
	return s.inTx(ctx, func(q *db.Queries) error {
		for _, ep := range episodes {
			err := q.UpsertEpisode(ctx, db.UpsertEpisodeParams{
				ShowID:        showID,
				SeasonNumber:  ep.SeasonNumber,
				EpisodeNumber: ep.EpisodeNumber,
				Title:         ep.Title,
				AirDate:       ep.AirDate,
				Runtime:       ep.Runtime,
				UpdatedAt:     now,
			})
			if err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *Store) CountEpisodes(ctx context.Context, showID int64) (int64, error) {
	return s.q.CountEpisodes(ctx, showID)
}

// CountSeasons returns the highest stored season number.
func (s *Store) CountSeasons(ctx context.Context, showID int64) (int64, error) {
	return s.q.CountSeasons(ctx, showID)
}

func (s *Store) SetEpisodeWatched(ctx context.Context, episodeID int64, watched bool) error {
	return expectAffected(s.q.SetEpisodeWatched(ctx, db.SetEpisodeWatchedParams{
		Watched: flag(watched),
		Now:     nowUTC(),
		ID:      episodeID,
	}))
}

func (s *Store) SetSeasonWatched(ctx context.Context, showID, season int64, watched bool) error {
	return expectAffected(s.q.SetSeasonWatched(ctx, db.SetSeasonWatchedParams{
		Watched:      flag(watched),
		Now:          nowUTC(),
		ShowID:       showID,
		SeasonNumber: season,
	}))
}

// EpisodeCounts returns the episode totals for each show that has episodes.
func (s *Store) EpisodeCounts(ctx context.Context, showIDs []int64) (map[int64]EpisodeCounts, error) {
	out := make(map[int64]EpisodeCounts, len(showIDs))
	if len(showIDs) == 0 {
		return out, nil
	}
	rows, err := s.q.EpisodeCounts(ctx, showIDs)
	if err != nil {
		return nil, err
	}
	for _, r := range rows {
		out[r.ShowID] = EpisodeCounts{Total: r.Total, Watched: r.Watched}
	}
	return out, nil
}
