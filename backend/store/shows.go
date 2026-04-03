package store

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

type RatingsUpdate struct {
	BfRating  *sql.Null[int64]
	GfRating  *sql.Null[int64]
	BfComment *sql.Null[string]
	GfComment *sql.Null[string]
}

type PriorityUpdate struct {
	BfWatchPriority *sql.Null[int32]
	GfWatchPriority *sql.Null[int32]
}

func nowUTC() string {
	return time.Now().UTC().Format(time.RFC3339)
}

func (s *Store) UpsertShow(ctx context.Context, show *Show) (int64, error) {
	if show == nil {
		return 0, errors.New("show is nil")
	}

	now := nowUTC()

	// Copy to avoid mutating caller-owned object.
	sh := *show

	sh.CreatedAt = now
	sh.UpdatedAt = now

	// Ensure new inserts start with NULL ratings/comments.
	sh.BfRating = sql.Null[int64]{}
	sh.GfRating = sql.Null[int64]{}
	sh.BfComment = sql.Null[string]{}
	sh.GfComment = sql.Null[string]{}

	_, err := s.db.NewInsert().
		Model(&sh).
		Column(
			"tmdb_id",
			"media_type",
			"title",
			"year",
			"genres",
			"overview",
			"poster_path",
			"imdb_id",
			"tmdb_rating",
			"tmdb_votes",
			"origin_country",
			"status",
			"bf_rating",
			"gf_rating",
			"bf_comment",
			"gf_comment",
			"created_at",
			"updated_at",
		).
		On("CONFLICT (tmdb_id, media_type) DO UPDATE").
		Set("title = EXCLUDED.title").
		Set("year = EXCLUDED.year").
		Set("genres = EXCLUDED.genres").
		Set("overview = EXCLUDED.overview").
		Set("poster_path = EXCLUDED.poster_path").
		Set("imdb_id = EXCLUDED.imdb_id").
		Set("tmdb_rating = EXCLUDED.tmdb_rating").
		Set("tmdb_votes = EXCLUDED.tmdb_votes").
		Set("origin_country = EXCLUDED.origin_country").
		Set("status = EXCLUDED.status").
		Set("updated_at = EXCLUDED.updated_at").
		Exec(ctx)
	if err != nil {
		return 0, err
	}

	return s.GetShowIDByTMDB(ctx, sh.TMDBID, sh.MediaType)
}

func (s *Store) GetShowIDByTMDB(ctx context.Context, tmdbID int64, mediaType string) (int64, error) {
	var id int64
	err := s.db.NewSelect().
		Table("shows").
		Column("id").
		Where("tmdb_id = ?", tmdbID).
		Where("media_type = ?", mediaType).
		Limit(1).
		Scan(ctx, &id)
	if err != nil {
		return 0, err
	}
	return id, nil
}

func (s *Store) GetShow(ctx context.Context, id int64) (Show, error) {
	var sh Show
	err := s.db.NewSelect().
		Model(&sh).
		Where("id = ?", id).
		Limit(1).
		Scan(ctx)
	return sh, err
}

func (s *Store) UpdateRatings(ctx context.Context, id int64, update RatingsUpdate) error {
	if update.BfRating == nil && update.GfRating == nil && update.BfComment == nil && update.GfComment == nil {
		return errors.New("no ratings fields provided")
	}

	now := nowUTC()

	q := s.db.NewUpdate().
		Table("shows").
		Where("id = ?", id).
		Set("status = ?", "watched").
		Set("bf_watch_priority = NULL").
		Set("gf_watch_priority = NULL").
		Set("updated_at = ?", now)

	if update.BfRating != nil {
		q = q.Set("bf_rating = ?", *update.BfRating)
	}
	if update.GfRating != nil {
		q = q.Set("gf_rating = ?", *update.GfRating)
	}
	if update.BfComment != nil {
		q = q.Set("bf_comment = ?", *update.BfComment)
	}
	if update.GfComment != nil {
		q = q.Set("gf_comment = ?", *update.GfComment)
	}

	res, err := q.Exec(ctx)
	if err != nil {
		return err
	}
	return expectRowsAffected(res)
}

func (s *Store) UpdatePriority(ctx context.Context, id int64, update PriorityUpdate) error {
	if update.BfWatchPriority == nil && update.GfWatchPriority == nil {
		return errors.New("no priority fields provided")
	}

	now := nowUTC()

	q := s.db.NewUpdate().
		Table("shows").
		Set("updated_at = ?", now).
		Where("id = ?", id)

	if update.BfWatchPriority != nil {
		q = q.Set("bf_watch_priority = ?", *update.BfWatchPriority)
	}
	if update.GfWatchPriority != nil {
		q = q.Set("gf_watch_priority = ?", *update.GfWatchPriority)
	}

	res, err := q.Exec(ctx)
	if err != nil {
		return err
	}
	return expectRowsAffected(res)
}

func (s *Store) UpdateStatus(ctx context.Context, id int64, status string) error {
	now := nowUTC()

	q := s.db.NewUpdate().
		Table("shows").
		Set("status = ?", status).
		Set("updated_at = ?", now).
		Where("id = ?", id)

	if status == "watched" {
		q = q.Set("bf_watch_priority = NULL").Set("gf_watch_priority = NULL")
	}

	res, err := q.Exec(ctx)
	if err != nil {
		return err
	}
	return expectRowsAffected(res)
}

func (s *Store) ClearRatings(ctx context.Context, id int64) error {
	now := nowUTC()

	res, err := s.db.NewUpdate().
		Table("shows").
		Set("bf_rating = NULL").
		Set("gf_rating = NULL").
		Set("bf_comment = NULL").
		Set("gf_comment = NULL").
		Set("updated_at = ?", now).
		Where("id = ?", id).
		Exec(ctx)
	if err != nil {
		return err
	}
	return expectRowsAffected(res)
}

func (s *Store) DeleteShow(ctx context.Context, id int64) error {
	res, err := s.db.NewDelete().
		Table("shows").
		Where("id = ?", id).
		Exec(ctx)
	if err != nil {
		return err
	}
	return expectRowsAffected(res)
}

func expectRowsAffected(res sql.Result) error {
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}
