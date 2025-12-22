// Package store provides SQLite persistence for shows and ratings.
package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync"
	"time"

	_ "modernc.org/sqlite"
)

type Store struct {
	db *sql.DB
}

var hasColumnCache sync.Map

type Show struct {
	ID            int64
	TMDBID        int64
	MediaType     string
	Title         string
	Year          sql.Null[int64]
	Genres        sql.Null[string]
	Overview      sql.Null[string]
	PosterPath    sql.Null[string]
	IMDbID        sql.Null[string]
	TMDBRating    sql.Null[float64]
	TMDBVotes     sql.Null[int64]
	OriginCountry sql.Null[string]
	Status        string
	BfRating      sql.Null[int64]
	GfRating      sql.Null[int64]
	BfComment     sql.Null[string]
	GfComment     sql.Null[string]
	CreatedAt     string
	UpdatedAt     string
}

type ListFilters struct {
	Status   string
	YearFrom *int
	YearTo   *int
	Genre    string
	Country  string
	Unrated  bool
	Sort     string
}

type TMDBRef struct {
	ID        int64
	MediaType string
}

type TMDBRefresh struct {
	TMDBID    int64
	MediaType string
	Status    string
}

func Open(dbPath string) (*Store, error) {
	if dbPath == "" {
		return nil, errors.New("DB_PATH is required")
	}

	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return nil, err
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}

	ctx := context.Background()
	if err := db.PingContext(ctx); err != nil {
		if cerr := db.Close(); cerr != nil {
			return nil, fmt.Errorf("ping db: %w; close failed: %w", err, cerr)
		}
		return nil, err
	}

	if err := initSchema(ctx, db); err != nil {
		if cerr := db.Close(); cerr != nil {
			return nil, fmt.Errorf("init schema: %w; close failed: %w", err, cerr)
		}
		return nil, err
	}

	return &Store{db: db}, nil
}

func (s *Store) Close() error { return s.db.Close() }

func initSchema(ctx context.Context, db *sql.DB) error {
	schema := `
CREATE TABLE IF NOT EXISTS shows (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	tmdb_id INTEGER NOT NULL,
	media_type TEXT NOT NULL,
	title TEXT NOT NULL,
	year INTEGER,
	genres TEXT,
	overview TEXT,
	poster_path TEXT,
	imdb_id TEXT,
	tmdb_rating REAL,
	tmdb_votes INTEGER,
	origin_country TEXT,
	status TEXT NOT NULL,
	bf_rating INTEGER,
	gf_rating INTEGER,
	bf_comment TEXT,
	gf_comment TEXT,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	UNIQUE(tmdb_id, media_type)
);
CREATE INDEX IF NOT EXISTS idx_shows_status ON shows(status);
CREATE INDEX IF NOT EXISTS idx_shows_year ON shows(year);
`
	if _, err := db.ExecContext(ctx, schema); err != nil {
		return err
	}

	if err := addColumnIfMissing(ctx, db, "shows", "imdb_id", "ALTER TABLE shows ADD COLUMN imdb_id TEXT"); err != nil {
		return err
	}
	if err := addColumnIfMissing(ctx, db, "shows", "tmdb_rating", "ALTER TABLE shows ADD COLUMN tmdb_rating REAL"); err != nil {
		return err
	}
	if err := addColumnIfMissing(ctx, db, "shows", "tmdb_votes", "ALTER TABLE shows ADD COLUMN tmdb_votes INTEGER"); err != nil {
		return err
	}
	if err := addColumnIfMissing(ctx, db, "shows", "origin_country", "ALTER TABLE shows ADD COLUMN origin_country TEXT"); err != nil {
		return err
	}
	return nil
}

func addColumnIfMissing(ctx context.Context, db *sql.DB, table, column, statement string) error {
	has, err := hasColumn(ctx, db, table, column)
	if err != nil {
		return err
	}
	if has {
		return nil
	}
	_, err = db.ExecContext(ctx, statement)
	if err != nil {
		has2, herr := hasColumn(ctx, db, table, column)
		if herr == nil && has2 {
			return nil
		}
	}
	return err
}

func hasColumn(ctx context.Context, db *sql.DB, table, column string) (bool, error) {
	cacheKey := table + "." + column
	if cached, ok := hasColumnCache.Load(cacheKey); ok {
		return cached.(bool), nil
	}
	rows, err := db.QueryContext(ctx, fmt.Sprintf("PRAGMA table_info(%s)", table))
	if err != nil {
		return false, err
	}

	for rows.Next() {
		var cid int
		var name string
		var ctype string
		var notnull int
		var dflt sql.Null[string]
		var pk int
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			if cerr := rows.Close(); cerr != nil {
				return false, cerr
			}
			return false, err
		}
		if name == column {
			if cerr := rows.Close(); cerr != nil {
				return false, cerr
			}
			hasColumnCache.Store(cacheKey, true)
			return true, nil
		}
	}
	if err := rows.Err(); err != nil {
		if cerr := rows.Close(); cerr != nil {
			return false, cerr
		}
		return false, err
	}
	if cerr := rows.Close(); cerr != nil {
		return false, cerr
	}
	hasColumnCache.Store(cacheKey, false)
	return false, nil
}

func (s *Store) UpsertShow(ctx context.Context, show *Show) (int64, error) {
	now := time.Now().UTC().Format(time.RFC3339)

	res, err := s.db.ExecContext(ctx, `
INSERT INTO shows (
	tmdb_id, media_type, title, year, genres, overview, poster_path, imdb_id, tmdb_rating, tmdb_votes, origin_country, status,
	bf_rating, gf_rating, bf_comment, gf_comment, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?)
ON CONFLICT(tmdb_id, media_type) DO UPDATE SET
	title=excluded.title,
	year=excluded.year,
	genres=excluded.genres,
	overview=excluded.overview,
	poster_path=excluded.poster_path,
	imdb_id=excluded.imdb_id,
	tmdb_rating=excluded.tmdb_rating,
	tmdb_votes=excluded.tmdb_votes,
	origin_country=excluded.origin_country,
	status=excluded.status,
	updated_at=excluded.updated_at
`,
		show.TMDBID,
		show.MediaType,
		show.Title,
		show.Year,
		show.Genres,
		show.Overview,
		show.PosterPath,
		show.IMDbID,
		show.TMDBRating,
		show.TMDBVotes,
		show.OriginCountry,
		show.Status,
		now,
		now,
	)
	if err != nil {
		return 0, err
	}

	id, err := res.LastInsertId()
	if err == nil && id != 0 {
		return id, nil
	}

	return s.GetShowIDByTMDB(ctx, show.TMDBID, show.MediaType)
}

func (s *Store) GetShowIDByTMDB(ctx context.Context, tmdbID int64, mediaType string) (int64, error) {
	var id int64
	err := s.db.QueryRowContext(ctx, `SELECT id FROM shows WHERE tmdb_id = ? AND media_type = ?`, tmdbID, mediaType).Scan(&id)
	if err != nil {
		return 0, err
	}
	return id, nil
}

func (s *Store) GetShow(ctx context.Context, id int64) (Show, error) {
	var sh Show
	err := s.db.QueryRowContext(ctx, `
SELECT id, tmdb_id, media_type, title, year, genres, overview, poster_path, imdb_id, tmdb_rating, tmdb_votes, origin_country,
	status, bf_rating, gf_rating, bf_comment, gf_comment, created_at, updated_at
FROM shows WHERE id = ?
`, id).Scan(
		&sh.ID,
		&sh.TMDBID,
		&sh.MediaType,
		&sh.Title,
		&sh.Year,
		&sh.Genres,
		&sh.Overview,
		&sh.PosterPath,
		&sh.IMDbID,
		&sh.TMDBRating,
		&sh.TMDBVotes,
		&sh.OriginCountry,
		&sh.Status,
		&sh.BfRating,
		&sh.GfRating,
		&sh.BfComment,
		&sh.GfComment,
		&sh.CreatedAt,
		&sh.UpdatedAt,
	)
	return sh, err
}

type RatingsUpdate struct {
	BfRating  *sql.Null[int64]
	GfRating  *sql.Null[int64]
	BfComment *sql.Null[string]
	GfComment *sql.Null[string]
}

func (s *Store) UpdateRatings(ctx context.Context, id int64, update RatingsUpdate) error {
	clauses := make([]string, 0, 6)
	args := make([]any, 0, 8)

	if update.BfRating != nil {
		clauses = append(clauses, "bf_rating = ?")
		args = append(args, *update.BfRating)
	}
	if update.GfRating != nil {
		clauses = append(clauses, "gf_rating = ?")
		args = append(args, *update.GfRating)
	}
	if update.BfComment != nil {
		clauses = append(clauses, "bf_comment = ?")
		args = append(args, *update.BfComment)
	}
	if update.GfComment != nil {
		clauses = append(clauses, "gf_comment = ?")
		args = append(args, *update.GfComment)
	}

	if len(clauses) == 0 {
		return errors.New("no ratings fields provided")
	}

	now := time.Now().UTC().Format(time.RFC3339)
	clauses = append(clauses, "status = ?", "updated_at = ?")
	args = append(args, "watched", now, id)

	//nolint:gosec // clauses are assembled from fixed column names only.
	query := fmt.Sprintf("UPDATE shows SET\n\t%s\nWHERE id = ?", strings.Join(clauses, ",\n\t"))
	res, err := s.db.ExecContext(ctx, query, args...)
	if err != nil {
		return err
	}
	return expectRowsAffected(res)
}

func (s *Store) UpdateStatus(ctx context.Context, id int64, status string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	res, err := s.db.ExecContext(ctx, `UPDATE shows SET status = ?, updated_at = ? WHERE id = ?`, status, now, id)
	if err != nil {
		return err
	}
	return expectRowsAffected(res)
}

func (s *Store) ClearRatings(ctx context.Context, id int64) error {
	now := time.Now().UTC().Format(time.RFC3339)
	res, err := s.db.ExecContext(ctx, `
UPDATE shows SET
	bf_rating = NULL,
	gf_rating = NULL,
	bf_comment = NULL,
	gf_comment = NULL,
	updated_at = ?
WHERE id = ?
`, now, id)
	if err != nil {
		return err
	}
	return expectRowsAffected(res)
}

func (s *Store) DeleteShow(ctx context.Context, id int64) error {
	res, err := s.db.ExecContext(ctx, `DELETE FROM shows WHERE id = ?`, id)
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

func (s *Store) InLibraryByTMDB(ctx context.Context, refs []TMDBRef) (out map[TMDBRef]bool, err error) {
	out = make(map[TMDBRef]bool, len(refs))
	if len(refs) == 0 {
		return out, nil
	}

	conds := make([]string, 0, len(refs))
	args := make([]any, 0, len(refs)*2)
	seen := make(map[TMDBRef]struct{}, len(refs))

	for _, ref := range refs {
		ref.MediaType = strings.TrimSpace(ref.MediaType)
		if ref.ID == 0 || ref.MediaType == "" {
			continue
		}
		if _, ok := seen[ref]; ok {
			continue
		}
		seen[ref] = struct{}{}
		conds = append(conds, "(tmdb_id = ? AND media_type = ?)")
		args = append(args, ref.ID, ref.MediaType)
	}

	if len(conds) == 0 {
		return out, nil
	}

	//nolint:gosec // conditions are assembled from fixed column names and placeholders.
	query := "SELECT tmdb_id, media_type FROM shows WHERE " + strings.Join(conds, " OR ")
	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer func() {
		if cerr := rows.Close(); cerr != nil && err == nil {
			err = cerr
		}
	}()

	for rows.Next() {
		var id int64
		var mediaType string
		if err := rows.Scan(&id, &mediaType); err != nil {
			return nil, err
		}
		out[TMDBRef{ID: id, MediaType: mediaType}] = true
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (s *Store) ListShows(ctx context.Context, filters ListFilters) (out []Show, err error) {
	clauses := []string{"1=1"}
	args := []any{}

	if filters.Status != "" && filters.Status != "all" {
		clauses = append(clauses, "status = ?")
		args = append(args, filters.Status)
	}
	if filters.YearFrom != nil {
		clauses = append(clauses, "year >= ?")
		args = append(args, *filters.YearFrom)
	}
	if filters.YearTo != nil {
		clauses = append(clauses, "year <= ?")
		args = append(args, *filters.YearTo)
	}
	if filters.Genre != "" {
		clauses = append(clauses, "genres LIKE ?")
		args = append(args, "%"+filters.Genre+"%")
	}
	if filters.Country != "" {
		clauses = append(clauses, "(origin_country = ? OR origin_country LIKE ? OR origin_country LIKE ? OR origin_country LIKE ?)")
		args = append(
			args,
			filters.Country,
			filters.Country+",%",
			"%, "+filters.Country+",%",
			"%, "+filters.Country,
		)
	}
	if filters.Unrated {
		clauses = append(clauses, "bf_rating IS NULL OR gf_rating IS NULL")
	}

	orderBy := "updated_at DESC"
	switch filters.Sort {
	case "avg":
		orderBy = `
		CASE
			WHEN bf_rating IS NULL AND gf_rating IS NULL THEN NULL
			ELSE (COALESCE(bf_rating, 0) + COALESCE(gf_rating, 0)) * 1.0 /
				NULLIF((bf_rating IS NOT NULL) + (gf_rating IS NOT NULL), 0)
		END DESC
		`
	case "bf":
		orderBy = "bf_rating DESC"
	case "gf":
		orderBy = "gf_rating DESC"
	case "year":
		orderBy = "year DESC"
	case "title":
		orderBy = "title COLLATE NOCASE ASC"
	}

	//nolint:gosec // clauses and orderBy are from a controlled set.
	query := fmt.Sprintf(`
SELECT id, tmdb_id, media_type, title, year, genres, overview, poster_path, imdb_id, tmdb_rating, tmdb_votes, origin_country,
	status, bf_rating, gf_rating, bf_comment, gf_comment, created_at, updated_at
FROM shows
WHERE %s
ORDER BY %s
`, strings.Join(clauses, " AND "), orderBy)

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer func() {
		cerr := rows.Close()
		if err == nil && cerr != nil {
			err = cerr
		}
	}()

	for rows.Next() {
		var sh Show
		if err := rows.Scan(
			&sh.ID,
			&sh.TMDBID,
			&sh.MediaType,
			&sh.Title,
			&sh.Year,
			&sh.Genres,
			&sh.Overview,
			&sh.PosterPath,
			&sh.IMDbID,
			&sh.TMDBRating,
			&sh.TMDBVotes,
			&sh.OriginCountry,
			&sh.Status,
			&sh.BfRating,
			&sh.GfRating,
			&sh.BfComment,
			&sh.GfComment,
			&sh.CreatedAt,
			&sh.UpdatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, sh)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

func (s *Store) ListAllGenres(ctx context.Context) (out []string, err error) {
	rows, err := s.db.QueryContext(ctx, `SELECT genres FROM shows WHERE genres IS NOT NULL AND genres != ''`)
	if err != nil {
		return nil, err
	}
	defer func() {
		cerr := rows.Close()
		if err == nil && cerr != nil {
			err = cerr
		}
	}()

	seen := map[string]struct{}{}
	for rows.Next() {
		var genres string
		if err := rows.Scan(&genres); err != nil {
			return nil, err
		}
		for _, g := range strings.Split(genres, ",") {
			g = strings.TrimSpace(g)
			if g == "" {
				continue
			}
			seen[g] = struct{}{}
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	out = make([]string, 0, len(seen))
	for g := range seen {
		out = append(out, g)
	}

	slices.SortFunc(out, func(a, b string) int {
		return strings.Compare(strings.ToLower(a), strings.ToLower(b))
	})
	return out, nil
}

func (s *Store) ListAllCountries(ctx context.Context) (out []string, err error) {
	rows, err := s.db.QueryContext(ctx, `SELECT origin_country FROM shows WHERE origin_country IS NOT NULL AND origin_country != ''`)
	if err != nil {
		return nil, err
	}
	defer func() {
		cerr := rows.Close()
		if err == nil && cerr != nil {
			err = cerr
		}
	}()

	seen := map[string]struct{}{}
	for rows.Next() {
		var codes string
		if err := rows.Scan(&codes); err != nil {
			return nil, err
		}
		for _, code := range strings.Split(codes, ",") {
			code = strings.TrimSpace(code)
			if code == "" {
				continue
			}
			seen[code] = struct{}{}
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	out = make([]string, 0, len(seen))
	for code := range seen {
		out = append(out, code)
	}

	slices.SortFunc(out, func(a, b string) int {
		return strings.Compare(strings.ToLower(a), strings.ToLower(b))
	})
	return out, nil
}

func (s *Store) ListTMDBMissing(ctx context.Context) (out []TMDBRefresh, err error) {
	rows, err := s.db.QueryContext(ctx, `
SELECT tmdb_id, media_type, status
FROM shows
WHERE tmdb_rating IS NULL OR tmdb_votes IS NULL OR imdb_id IS NULL OR origin_country IS NULL OR origin_country = ''
`)
	if err != nil {
		return nil, err
	}
	defer func() {
		if cerr := rows.Close(); cerr != nil && err == nil {
			err = cerr
		}
	}()

	out = []TMDBRefresh{}
	for rows.Next() {
		var item TMDBRefresh
		if err := rows.Scan(&item.TMDBID, &item.MediaType, &item.Status); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}
