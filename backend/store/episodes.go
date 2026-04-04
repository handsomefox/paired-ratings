package store

import (
	"context"
	"database/sql"
	"time"

	"github.com/uptrace/bun"
)

type Episode struct {
	bun.BaseModel `bun:"table:episodes,alias:e"`

	ID            int64  `bun:"id,pk,autoincrement"`
	ShowID        int64  `bun:"show_id,notnull"`
	SeasonNumber  int    `bun:"season_number,notnull"`
	EpisodeNumber int    `bun:"episode_number,notnull"`
	Title         string `bun:"title"`
	Overview      string `bun:"overview"`
	AirDate       string `bun:"air_date"`
	Runtime       int    `bun:"runtime"`
	Watched       bool   `bun:"watched,notnull"`
	UpdatedAt     string `bun:"updated_at,notnull"`
}

func (s *Store) GetEpisodes(ctx context.Context, showID int64) ([]Episode, error) {
	var episodes []Episode
	err := s.db.NewSelect().
		Model(&episodes).
		Where("show_id = ?", showID).
		OrderExpr("season_number ASC, episode_number ASC").
		Scan(ctx)
	return episodes, err
}

// SyncEpisodes upserts episodes for a given show and season, preserving
// existing watched state.
func (s *Store) SyncEpisodes(ctx context.Context, showID int64, episodes []Episode) error {
	if len(episodes) == 0 {
		return nil
	}

	now := time.Now().UTC().Format(time.RFC3339)

	tx, err := s.sqldb.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	for _, ep := range episodes {
		_, err := tx.ExecContext(ctx, `
			INSERT INTO episodes (show_id, season_number, episode_number, title, overview, air_date, runtime, watched, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
			ON CONFLICT (show_id, season_number, episode_number) DO UPDATE SET
				title = excluded.title,
				overview = excluded.overview,
				air_date = excluded.air_date,
				runtime = excluded.runtime,
				updated_at = excluded.updated_at
		`, ep.ShowID, ep.SeasonNumber, ep.EpisodeNumber, ep.Title, ep.Overview, ep.AirDate, ep.Runtime, now)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (s *Store) ToggleEpisode(ctx context.Context, episodeID int64, watched bool) error {
	val := 0
	if watched {
		val = 1
	}

	now := time.Now().UTC().Format(time.RFC3339)

	res, err := s.db.NewUpdate().
		Table("episodes").
		Set("watched = ?", val).
		Set("updated_at = ?", now).
		Where("id = ?", episodeID).
		Exec(ctx)
	if err != nil {
		return err
	}
	return expectRowsAffected(res)
}

func (s *Store) EpisodeCountForShow(ctx context.Context, showID int64) (int, error) {
	count, err := s.db.NewSelect().
		Table("episodes").
		Where("show_id = ?", showID).
		Count(ctx)
	return count, err
}

func (s *Store) ToggleSeason(ctx context.Context, showID int64, seasonNumber int, watched bool) error {
	val := 0
	if watched {
		val = 1
	}
	now := time.Now().UTC().Format(time.RFC3339)
	res, err := s.db.NewUpdate().
		Table("episodes").
		Set("watched = ?", val).
		Set("updated_at = ?", now).
		Where("show_id = ?", showID).
		Where("season_number = ?", seasonNumber).
		Exec(ctx)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}
