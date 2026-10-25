package store

// This file converts the pre-baseline production database once. Delete it,
// legacy_test.go and cmd/convert-legacy after production runs on the new file.

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"reflect"
	"strings"

	"github.com/handsomefox/paired-ratings/backend/gen/db"
	"github.com/handsomefox/paired-ratings/backend/logger"
)

// LegacyReport counts what ConvertLegacy copied and what it left behind.
type LegacyReport struct {
	Shows int
	// Episodes counts the episodes copied.
	Episodes int
	// OrphanEpisodes counts episodes of deleted shows. The old schema never
	// enforced its foreign key, so these rows outlived their shows.
	OrphanEpisodes int
	// EmptyComments counts comments stored as "" that now read as no comment.
	EmptyComments int
}

// legacyShow is one row of the old shows table.
type legacyShow struct {
	ID              int64
	TMDBID          int64
	MediaType       string
	Title           string
	Year            *int64
	Genres          *string
	Overview        *string
	PosterPath      *string
	IMDbID          *string
	TMDBRating      *float64
	TMDBVotes       *int64
	OriginCountry   *string
	Status          string
	BfRating        *int64
	GfRating        *int64
	BfComment       *string
	GfComment       *string
	CreatedAt       string
	UpdatedAt       string
	WatchPriority   *int64
	CollectionID    *int64
	CollectionName  *string
	TMDBRefreshedAt *string
}

type legacyEpisode struct {
	Episode

	UpdatedAt string
}

// neverRefreshed marks a show the old schema never refreshed, so the next TMDB
// refresh picks it up.
const neverRefreshed = "1970-01-01T00:00:00Z"

// ConvertLegacy copies the database at src, in the schema from before the
// 001_schema baseline, into a new database at dst. src must be a local copy:
// opening it may checkpoint its WAL. dst must not exist.
//
// After the copy, ConvertLegacy reads every show and episode back from dst and
// compares it with what src holds. Any difference is an error.
func ConvertLegacy(ctx context.Context, src, dst string) (*LegacyReport, error) {
	if _, err := os.Stat(dst); !errors.Is(err, os.ErrNotExist) {
		return nil, fmt.Errorf("destination %s already exists", dst)
	}

	srcDB, err := sql.Open("sqlite", src+"?_pragma=busy_timeout(5000)")
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := srcDB.Close(); err != nil {
			slog.Warn("close legacy database failed", logger.Error(err))
		}
	}()

	legacy, err := isLegacySchema(ctx, srcDB)
	if err != nil {
		return nil, err
	}
	if !legacy {
		return nil, fmt.Errorf("%s is not in the legacy schema", src)
	}
	// Only the page structure: the source is known to hold orphaned episodes.
	if err := checkPages(ctx, srcDB); err != nil {
		return nil, fmt.Errorf("source: %w", err)
	}

	shows, err := readLegacyShows(ctx, srcDB)
	if err != nil {
		return nil, err
	}
	episodes, orphans, err := readLegacyEpisodes(ctx, srcDB)
	if err != nil {
		return nil, err
	}

	st, err := Open(ctx, dst)
	if err != nil {
		return nil, err
	}

	report := &LegacyReport{Shows: len(shows), Episodes: len(episodes), OrphanEpisodes: orphans}
	for i := range shows {
		for _, c := range []*string{shows[i].BfComment, shows[i].GfComment} {
			if c != nil && strings.TrimSpace(*c) == "" {
				report.EmptyComments++
			}
		}
	}

	err = writeConverted(ctx, st, shows, episodes)
	if err == nil {
		err = verifyConverted(ctx, st, shows, episodes)
	}
	if err == nil {
		err = finishFile(ctx, st)
	}
	if cerr := st.Close(); cerr != nil {
		err = errors.Join(err, cerr)
	}
	if err != nil {
		return nil, err
	}
	return report, nil
}

func readLegacyShows(ctx context.Context, srcDB *sql.DB) ([]legacyShow, error) {
	rows, err := srcDB.QueryContext(ctx, `
		SELECT id, tmdb_id, media_type, title, year, genres, overview, poster_path,
			imdb_id, tmdb_rating, tmdb_votes, origin_country, status, bf_rating,
			gf_rating, bf_comment, gf_comment, created_at, updated_at,
			watch_priority, collection_id, collection_name, tmdb_refreshed_at
		FROM shows ORDER BY id`)
	if err != nil {
		return nil, err
	}
	defer closeRows(rows)

	var out []legacyShow
	for rows.Next() {
		var s legacyShow
		err := rows.Scan(&s.ID, &s.TMDBID, &s.MediaType, &s.Title, &s.Year, &s.Genres,
			&s.Overview, &s.PosterPath, &s.IMDbID, &s.TMDBRating, &s.TMDBVotes,
			&s.OriginCountry, &s.Status, &s.BfRating, &s.GfRating, &s.BfComment,
			&s.GfComment, &s.CreatedAt, &s.UpdatedAt, &s.WatchPriority,
			&s.CollectionID, &s.CollectionName, &s.TMDBRefreshedAt)
		if err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

func readLegacyEpisodes(ctx context.Context, srcDB *sql.DB) (kept []legacyEpisode, orphans int, err error) {
	err = srcDB.QueryRowContext(ctx,
		`SELECT count(*) FROM episodes WHERE show_id NOT IN (SELECT id FROM shows)`,
	).Scan(&orphans)
	if err != nil {
		return nil, 0, err
	}

	rows, err := srcDB.QueryContext(ctx, `
		SELECT id, show_id, season_number, episode_number, title, air_date, runtime,
			watched, updated_at
		FROM episodes WHERE show_id IN (SELECT id FROM shows) ORDER BY id`)
	if err != nil {
		return nil, 0, err
	}
	defer closeRows(rows)

	for rows.Next() {
		var e legacyEpisode
		var watched int64
		err := rows.Scan(&e.ID, &e.ShowID, &e.SeasonNumber, &e.EpisodeNumber, &e.Title,
			&e.AirDate, &e.Runtime, &watched, &e.UpdatedAt)
		if err != nil {
			return nil, 0, err
		}
		e.Watched = watched != 0
		kept = append(kept, e)
	}
	return kept, orphans, rows.Err()
}

// converted is what the new schema stores for a legacy show.
func converted(s *legacyShow) Show {
	refreshed := neverRefreshed
	if s.TMDBRefreshedAt != nil {
		refreshed = *s.TMDBRefreshedAt
	}
	return Show{
		Metadata: Metadata{
			TMDBID:         s.TMDBID,
			MediaType:      MediaType(s.MediaType),
			Title:          s.Title,
			Year:           s.Year,
			Overview:       nonEmpty(s.Overview),
			PosterPath:     nonEmpty(s.PosterPath),
			IMDbID:         nonEmpty(s.IMDbID),
			TMDBRating:     s.TMDBRating,
			TMDBVotes:      s.TMDBVotes,
			CollectionID:   s.CollectionID,
			CollectionName: nonEmpty(s.CollectionName),
			Genres:         splitList(s.Genres),
			Countries:      splitList(s.OriginCountry),
		},
		ID:              s.ID,
		Status:          Status(s.Status),
		WatchPriority:   s.WatchPriority,
		BfRating:        s.BfRating,
		GfRating:        s.GfRating,
		BfComment:       nonEmpty(s.BfComment),
		GfComment:       nonEmpty(s.GfComment),
		CreatedAt:       s.CreatedAt,
		UpdatedAt:       s.UpdatedAt,
		TMDBRefreshedAt: refreshed,
	}
}

func convertedEpisode(e *legacyEpisode) legacyEpisode {
	out := *e
	out.Title = nonEmpty(e.Title)
	out.AirDate = nonEmpty(e.AirDate)
	if e.Runtime != nil && *e.Runtime == 0 {
		out.Runtime = nil
	}
	return out
}

func nonEmpty(s *string) *string {
	if s == nil || strings.TrimSpace(*s) == "" {
		return nil
	}
	return s
}

// splitList splits the old ", "-joined columns and drops repeats.
func splitList(s *string) []string {
	if s == nil {
		return nil
	}
	var out []string
	seen := map[string]bool{}
	for part := range strings.SplitSeq(*s, ",") {
		part = strings.TrimSpace(part)
		if part != "" && !seen[part] {
			seen[part] = true
			out = append(out, part)
		}
	}
	return out
}

func writeConverted(ctx context.Context, st *Store, shows []legacyShow, episodes []legacyEpisode) error {
	return st.withTx(ctx, func(tx *sql.Tx) error {
		return insertConverted(ctx, tx, st.q.WithTx(tx), shows, episodes)
	})
}

func insertConverted(ctx context.Context, tx *sql.Tx, q *db.Queries, shows []legacyShow, episodes []legacyEpisode) error {
	for i := range shows {
		s := converted(&shows[i])
		_, err := tx.ExecContext(ctx, `
			INSERT INTO shows (id, tmdb_id, media_type, title, year, overview, poster_path,
				imdb_id, tmdb_rating, tmdb_votes, collection_id, collection_name, status,
				watch_priority, bf_rating, gf_rating, bf_comment, gf_comment, created_at,
				updated_at, tmdb_refreshed_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			s.ID, s.TMDBID, s.MediaType, s.Title, s.Year, s.Overview, s.PosterPath,
			s.IMDbID, s.TMDBRating, s.TMDBVotes, s.CollectionID, s.CollectionName, s.Status,
			s.WatchPriority, s.BfRating, s.GfRating, s.BfComment, s.GfComment, s.CreatedAt,
			s.UpdatedAt, s.TMDBRefreshedAt)
		if err != nil {
			return fmt.Errorf("show %d: %w", s.ID, err)
		}
		if err := replaceGenresAndCountries(ctx, q, s.ID, s.Genres, s.Countries); err != nil {
			return fmt.Errorf("show %d: %w", s.ID, err)
		}
	}

	for i := range episodes {
		e := convertedEpisode(&episodes[i])
		_, err := tx.ExecContext(ctx, `
			INSERT INTO episodes (id, show_id, season_number, episode_number, title, air_date,
				runtime, watched, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			e.ID, e.ShowID, e.SeasonNumber, e.EpisodeNumber, e.Title, e.AirDate,
			e.Runtime, flag(e.Watched), e.UpdatedAt)
		if err != nil {
			return fmt.Errorf("episode %d: %w", e.ID, err)
		}
	}
	return nil
}

func verifyConverted(ctx context.Context, st *Store, shows []legacyShow, episodes []legacyEpisode) error {
	stored, total, err := st.ListShows(ctx, &ListFilters{})
	if err != nil {
		return err
	}
	if int(total) != len(shows) || len(stored) != len(shows) {
		return fmt.Errorf("verify: %d shows in the source, %d in the copy", len(shows), len(stored))
	}
	byID := make(map[int64]Show, len(stored))
	for i := range stored {
		byID[stored[i].ID] = stored[i]
	}
	for i := range shows {
		want := converted(&shows[i])
		if got := byID[want.ID]; !reflect.DeepEqual(got, want) {
			return fmt.Errorf("verify: show %d differs:\n source %+v\n copy   %+v", want.ID, want, got)
		}
	}

	rows, err := st.sqldb.QueryContext(ctx, `
		SELECT id, show_id, season_number, episode_number, title, air_date, runtime,
			watched, updated_at
		FROM episodes ORDER BY id`)
	if err != nil {
		return err
	}
	defer closeRows(rows)
	i := 0
	for ; rows.Next(); i++ {
		var got legacyEpisode
		var watched int64
		err := rows.Scan(&got.ID, &got.ShowID, &got.SeasonNumber, &got.EpisodeNumber, &got.Title,
			&got.AirDate, &got.Runtime, &watched, &got.UpdatedAt)
		if err != nil {
			return err
		}
		got.Watched = watched != 0
		if i >= len(episodes) {
			return errors.New("verify: the copy has more episodes than the source")
		}
		if want := convertedEpisode(&episodes[i]); !reflect.DeepEqual(got, want) {
			return fmt.Errorf("verify: episode %d differs:\n source %+v\n copy   %+v", want.ID, want, got)
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if i != len(episodes) {
		return fmt.Errorf("verify: %d episodes in the source, %d in the copy", len(episodes), i)
	}

	return checkIntegrity(ctx, st.sqldb)
}

func checkIntegrity(ctx context.Context, sqldb *sql.DB) error {
	if err := checkPages(ctx, sqldb); err != nil {
		return err
	}
	rows, err := sqldb.QueryContext(ctx, "PRAGMA foreign_key_check")
	if err != nil {
		return err
	}
	defer closeRows(rows)
	if rows.Next() {
		return errors.New("foreign key check found rows without a parent")
	}
	return rows.Err()
}

func closeRows(rows *sql.Rows) {
	if err := rows.Close(); err != nil {
		slog.Warn("close rows failed", logger.Error(err))
	}
}

func checkPages(ctx context.Context, sqldb *sql.DB) error {
	var result string
	if err := sqldb.QueryRowContext(ctx, "PRAGMA integrity_check").Scan(&result); err != nil {
		return err
	}
	if result != "ok" {
		return fmt.Errorf("integrity check: %s", result)
	}
	return nil
}

// finishFile folds the WAL into the main file and leaves rollback-journal mode,
// so dst is one self-contained file that can be copied as is. The server turns
// WAL back on when it opens the file.
func finishFile(ctx context.Context, st *Store) error {
	if _, err := st.sqldb.ExecContext(ctx, "PRAGMA wal_checkpoint(TRUNCATE)"); err != nil {
		return err
	}
	_, err := st.sqldb.ExecContext(ctx, "PRAGMA journal_mode = DELETE")
	return err
}
