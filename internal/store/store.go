// Package store handles SQLite persistence for shows and ratings.
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
	"time"

	_ "modernc.org/sqlite"
)

type Store struct {
	db *sql.DB
}

type Show struct {
	ID         int64
	TMDBID     int64
	MediaType  string
	Title      string
	Year       sql.NullInt64
	Genres     sql.NullString
	Overview   sql.NullString
	PosterPath sql.NullString
	IMDbID     sql.NullString
	TMDBRating sql.NullFloat64
	TMDBVotes  sql.NullInt64
	Status     string
	BfRating   sql.NullInt64
	GfRating   sql.NullInt64
	BfComment  sql.NullString
	GfComment  sql.NullString
	CreatedAt  string
	UpdatedAt  string
}

type ListFilters struct {
	Status   string
	YearFrom *int
	YearTo   *int
	Genre    string
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
			return nil, fmt.Errorf("ping db: %w", errors.Join(err, cerr))
		}
		return nil, err
	}
	if err := initSchema(ctx, db); err != nil {
		if cerr := db.Close(); cerr != nil {
			return nil, fmt.Errorf("init schema: %w", errors.Join(err, cerr))
		}
		return nil, err
	}
	return &Store{db: db}, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

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
	_, err := db.ExecContext(ctx, schema)
	if err != nil {
		return err
	}
	if err := addColumn(ctx, db, "shows", "imdb_id", "ALTER TABLE shows ADD COLUMN imdb_id TEXT"); err != nil {
		return err
	}
	if err := addColumn(ctx, db, "shows", "tmdb_rating", "ALTER TABLE shows ADD COLUMN tmdb_rating REAL"); err != nil {
		return err
	}
	if err := addColumn(ctx, db, "shows", "tmdb_votes", "ALTER TABLE shows ADD COLUMN tmdb_votes INTEGER"); err != nil {
		return err
	}
	return nil
}

func (s *Store) UpsertShow(show *Show) (int64, error) {
	ctx := context.Background()
	now := time.Now().UTC().Format(time.RFC3339)
	res, err := s.db.ExecContext(ctx, `
INSERT INTO shows (
	tmdb_id, media_type, title, year, genres, overview, poster_path, imdb_id, tmdb_rating, tmdb_votes, status,
	bf_rating, gf_rating, bf_comment, gf_comment, created_at, updated_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?, ?)
ON CONFLICT(tmdb_id, media_type) DO UPDATE SET
	title=excluded.title,
	year=excluded.year,
	genres=excluded.genres,
	overview=excluded.overview,
	poster_path=excluded.poster_path,
	imdb_id=excluded.imdb_id,
	tmdb_rating=excluded.tmdb_rating,
	tmdb_votes=excluded.tmdb_votes,
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
	return s.GetShowIDByTMDB(show.TMDBID, show.MediaType)
}

func (s *Store) GetShowIDByTMDB(tmdbID int64, mediaType string) (int64, error) {
	ctx := context.Background()
	var id int64
	err := s.db.QueryRowContext(ctx, `SELECT id FROM shows WHERE tmdb_id = ? AND media_type = ?`, tmdbID, mediaType).Scan(&id)
	if err != nil {
		return 0, err
	}
	return id, nil
}

func (s *Store) InLibraryByTMDB(refs []TMDBRef) (map[TMDBRef]bool, error) {
	ctx := context.Background()
	out := make(map[TMDBRef]bool, len(refs))
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
	query := fmt.Sprintf("SELECT tmdb_id, media_type FROM shows WHERE %s", strings.Join(conds, " OR "))
	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
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

func (s *Store) GetShow(id int64) (Show, error) {
	ctx := context.Background()
	var sh Show
	err := s.db.QueryRowContext(ctx, `
SELECT id, tmdb_id, media_type, title, year, genres, overview, poster_path, imdb_id, tmdb_rating, tmdb_votes, status,
	bf_rating, gf_rating, bf_comment, gf_comment, created_at, updated_at
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

func (s *Store) UpdateRatings(id int64, bfRating, gfRating sql.NullInt64, bfComment, gfComment sql.NullString) error {
	ctx := context.Background()
	now := time.Now().UTC().Format(time.RFC3339)
	status := "watched"
	_, err := s.db.ExecContext(ctx, `
UPDATE shows SET
	bf_rating = ?,
	gf_rating = ?,
	bf_comment = ?,
	gf_comment = ?,
	status = ?,
	updated_at = ?
WHERE id = ?
`,
		bfRating,
		gfRating,
		bfComment,
		gfComment,
		status,
		now,
		id,
	)
	return err
}

func (s *Store) UpdateStatus(id int64, status string) error {
	ctx := context.Background()
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.ExecContext(ctx, `UPDATE shows SET status = ?, updated_at = ? WHERE id = ?`, status, now, id)
	return err
}

func (s *Store) ClearRatings(id int64) error {
	ctx := context.Background()
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.ExecContext(ctx, `
UPDATE shows SET
	bf_rating = NULL,
	gf_rating = NULL,
	updated_at = ?
WHERE id = ?
`, now, id)
	return err
}

func (s *Store) DeleteShow(id int64) error {
	ctx := context.Background()
	_, err := s.db.ExecContext(ctx, `DELETE FROM shows WHERE id = ?`, id)
	return err
}

func (s *Store) ListShows(filters ListFilters) (out []Show, err error) {
	ctx := context.Background()
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
	if filters.Unrated {
		clauses = append(clauses, "bf_rating IS NULL AND gf_rating IS NULL")
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

	//nolint:gosec // orderBy and clauses are constructed from a controlled set of options.
	query := fmt.Sprintf(`
SELECT id, tmdb_id, media_type, title, year, genres, overview, poster_path, imdb_id, tmdb_rating, tmdb_votes, status,
	bf_rating, gf_rating, bf_comment, gf_comment, created_at, updated_at
FROM shows
WHERE %s
ORDER BY %s
`, strings.Join(clauses, " AND "), orderBy)

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer func() {
		if cerr := rows.Close(); err == nil && cerr != nil {
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

func addColumn(ctx context.Context, db *sql.DB, table, column, statement string) error {
	if columnExists, err := hasColumn(ctx, db, table, column); err != nil {
		return err
	} else if columnExists {
		return nil
	}
	if _, err := db.ExecContext(ctx, statement); err != nil {
		if columnExists, cerr := hasColumn(ctx, db, table, column); cerr == nil && columnExists {
			return nil
		}
		return err
	}
	return nil
}

func hasColumn(ctx context.Context, db *sql.DB, table, column string) (bool, error) {
	rows, err := db.QueryContext(ctx, fmt.Sprintf("PRAGMA table_info(%s)", table))
	if err != nil {
		return false, err
	}
	defer rows.Close()
	for rows.Next() {
		var cid int
		var name string
		var ctype string
		var notnull int
		var dflt sql.NullString
		var pk int
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			return false, err
		}
		if name == column {
			return true, nil
		}
	}
	return false, rows.Err()
}

func (s *Store) ListAllGenres() (out []string, err error) {
	ctx := context.Background()
	rows, err := s.db.QueryContext(ctx, `SELECT genres FROM shows WHERE genres IS NOT NULL AND genres != ''`)
	if err != nil {
		return nil, err
	}
	defer func() {
		if cerr := rows.Close(); err == nil && cerr != nil {
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

func (s *Store) ListTMDBMissing() ([]TMDBRefresh, error) {
	ctx := context.Background()
	rows, err := s.db.QueryContext(ctx, `
SELECT tmdb_id, media_type, status
FROM shows
WHERE tmdb_rating IS NULL OR tmdb_votes IS NULL OR imdb_id IS NULL
`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []TMDBRefresh{}
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
