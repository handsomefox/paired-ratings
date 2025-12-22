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

	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/sqlitedialect"

	_ "modernc.org/sqlite"
)

type Store struct {
	sqldb *sql.DB
	db    *bun.DB
}

// Cache used only for schema checks on startup.
// Key format: "<table>.<column>" -> bool.
var hasColumnCache sync.Map

type Show struct {
	bun.BaseModel `bun:"table:shows,alias:s"`

	ID            int64             `bun:"id,pk,autoincrement"`
	TMDBID        int64             `bun:"tmdb_id,notnull"`
	MediaType     string            `bun:"media_type,notnull"`
	Title         string            `bun:"title,notnull"`
	Year          sql.Null[int64]   `bun:"year,nullzero"`
	Genres        sql.Null[string]  `bun:"genres,nullzero"`
	Overview      sql.Null[string]  `bun:"overview,nullzero"`
	PosterPath    sql.Null[string]  `bun:"poster_path,nullzero"`
	IMDbID        sql.Null[string]  `bun:"imdb_id,nullzero"`
	TMDBRating    sql.Null[float64] `bun:"tmdb_rating,nullzero"`
	TMDBVotes     sql.Null[int64]   `bun:"tmdb_votes,nullzero"`
	OriginCountry sql.Null[string]  `bun:"origin_country,nullzero"`
	Status        string            `bun:"status,notnull"`

	BfRating  sql.Null[int64]  `bun:"bf_rating,nullzero"`
	GfRating  sql.Null[int64]  `bun:"gf_rating,nullzero"`
	BfComment sql.Null[string] `bun:"bf_comment,nullzero"`
	GfComment sql.Null[string] `bun:"gf_comment,nullzero"`

	CreatedAt string `bun:"created_at,notnull"`
	UpdatedAt string `bun:"updated_at,notnull"`
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
	ID        int64  `bun:"tmdb_id"`
	MediaType string `bun:"media_type"`
}

type TMDBRefresh struct {
	TMDBID    int64  `bun:"tmdb_id"`
	MediaType string `bun:"media_type"`
	Status    string `bun:"status"`
}

func Open(dbPath string) (*Store, error) {
	if dbPath == "" {
		return nil, errors.New("DB_PATH is required")
	}

	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return nil, err
	}

	sqldb, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}

	// SQLite behaves best with a small connection pool.
	sqldb.SetMaxOpenConns(1)
	sqldb.SetMaxIdleConns(1)
	sqldb.SetConnMaxLifetime(0)

	ctx := context.Background()
	if err := sqldb.PingContext(ctx); err != nil {
		if cerr := sqldb.Close(); cerr != nil {
			return nil, fmt.Errorf("ping db: %w; close failed: %w", err, cerr)
		}
		return nil, err
	}

	if err := applyPragmas(ctx, sqldb); err != nil {
		if cerr := sqldb.Close(); cerr != nil {
			return nil, fmt.Errorf("apply pragmas: %w; close failed: %w", err, cerr)
		}
		return nil, err
	}

	if err := initSchema(ctx, sqldb); err != nil {
		if cerr := sqldb.Close(); cerr != nil {
			return nil, fmt.Errorf("init schema: %w; close failed: %w", err, cerr)
		}
		return nil, err
	}

	bdb := bun.NewDB(sqldb, sqlitedialect.New())
	return &Store{sqldb: sqldb, db: bdb}, nil
}

func (s *Store) Close() error {
	if s == nil || s.sqldb == nil {
		return nil
	}
	return s.sqldb.Close()
}

func applyPragmas(ctx context.Context, db *sql.DB) error {
	stmts := []string{
		"PRAGMA journal_mode = WAL;",
		"PRAGMA busy_timeout = 5000;",
	}

	for _, stmt := range stmts {
		if _, err := db.ExecContext(ctx, stmt); err != nil {
			return err
		}
	}
	return nil
}

func initSchema(ctx context.Context, db *sql.DB) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

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
	if _, err := tx.ExecContext(ctx, schema); err != nil {
		return err
	}

	// Migrations for older DB files where the table already exists but columns were added later.
	if err := addColumnIfMissingTx(ctx, tx, "shows", "imdb_id", "ALTER TABLE shows ADD COLUMN imdb_id TEXT"); err != nil {
		return err
	}
	if err := addColumnIfMissingTx(ctx, tx, "shows", "tmdb_rating", "ALTER TABLE shows ADD COLUMN tmdb_rating REAL"); err != nil {
		return err
	}
	if err := addColumnIfMissingTx(ctx, tx, "shows", "tmdb_votes", "ALTER TABLE shows ADD COLUMN tmdb_votes INTEGER"); err != nil {
		return err
	}
	if err := addColumnIfMissingTx(ctx, tx, "shows", "origin_country", "ALTER TABLE shows ADD COLUMN origin_country TEXT"); err != nil {
		return err
	}

	return tx.Commit()
}

func addColumnIfMissingTx(ctx context.Context, tx *sql.Tx, table, column, statement string) error {
	cacheKey := table + "." + column

	has, err := hasColumnTx(ctx, tx, table, column)
	if err != nil {
		return err
	}
	if has {
		return nil
	}

	if _, err := tx.ExecContext(ctx, statement); err != nil {
		// If it failed because the column already exists (or concurrent init),
		// the column will be visible now. Treat that as success.
		hasColumnCache.Delete(cacheKey)
		has2, herr := hasColumnTx(ctx, tx, table, column)
		if herr == nil && has2 {
			hasColumnCache.Store(cacheKey, true)
			return nil
		}
		return err
	}

	hasColumnCache.Store(cacheKey, true)
	return nil
}

func hasColumnTx(ctx context.Context, tx *sql.Tx, table, column string) (bool, error) {
	cacheKey := table + "." + column
	if cached, ok := hasColumnCache.Load(cacheKey); ok {
		return cached.(bool), nil
	}

	rows, err := tx.QueryContext(ctx, fmt.Sprintf("PRAGMA table_info(%s)", table))
	if err != nil {
		return false, err
	}
	defer rows.Close()

	for rows.Next() {
		var cid int
		var name string
		var ctype string
		var notnull int
		var dflt sql.Null[string]
		var pk int
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			return false, err
		}
		if name == column {
			hasColumnCache.Store(cacheKey, true)
			return true, nil
		}
	}
	if err := rows.Err(); err != nil {
		return false, err
	}

	hasColumnCache.Store(cacheKey, false)
	return false, nil
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

type RatingsUpdate struct {
	BfRating  *sql.Null[int64]
	GfRating  *sql.Null[int64]
	BfComment *sql.Null[string]
	GfComment *sql.Null[string]
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

func (s *Store) UpdateStatus(ctx context.Context, id int64, status string) error {
	now := nowUTC()

	res, err := s.db.NewUpdate().
		Table("shows").
		Set("status = ?", status).
		Set("updated_at = ?", now).
		Where("id = ?", id).
		Exec(ctx)
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

func (s *Store) InLibraryByTMDB(ctx context.Context, refs []TMDBRef) (map[TMDBRef]bool, error) {
	out := make(map[TMDBRef]bool, len(refs))
	if len(refs) == 0 {
		return out, nil
	}

	seen := make(map[TMDBRef]struct{}, len(refs))
	uniq := make([]TMDBRef, 0, len(refs))
	for _, ref := range refs {
		ref.MediaType = strings.TrimSpace(ref.MediaType)
		if ref.ID == 0 || ref.MediaType == "" {
			continue
		}
		if _, ok := seen[ref]; ok {
			continue
		}
		seen[ref] = struct{}{}
		uniq = append(uniq, ref)
	}
	if len(uniq) == 0 {
		return out, nil
	}

	q := s.db.NewSelect().
		Table("shows").
		Column("tmdb_id", "media_type")

	first := true
	for _, ref := range uniq {
		if first {
			q = q.Where("tmdb_id = ? AND media_type = ?", ref.ID, ref.MediaType)
			first = false
			continue
		}
		q = q.WhereOr("tmdb_id = ? AND media_type = ?", ref.ID, ref.MediaType)
	}

	var found []TMDBRef
	if err := q.Scan(ctx, &found); err != nil {
		return nil, err
	}

	for _, ref := range found {
		out[TMDBRef{ID: ref.ID, MediaType: ref.MediaType}] = true
	}
	return out, nil
}

func (s *Store) ListShows(ctx context.Context, filters ListFilters) (out []Show, err error) {
	q := s.db.NewSelect().Model(&out)

	if filters.Status != "" && filters.Status != "all" {
		q = q.Where("status = ?", filters.Status)
	}
	if filters.YearFrom != nil {
		q = q.Where("year >= ?", *filters.YearFrom)
	}
	if filters.YearTo != nil {
		q = q.Where("year <= ?", *filters.YearTo)
	}
	if filters.Genre != "" {
		q = q.Where("genres LIKE ?", "%"+filters.Genre+"%")
	}
	if filters.Country != "" {
		c := filters.Country
		q = q.WhereGroup(" AND ", func(q *bun.SelectQuery) *bun.SelectQuery {
			return q.
				Where("origin_country = ?", c).
				WhereOr("origin_country LIKE ?", c+",%").
				WhereOr("origin_country LIKE ?", "%, "+c+",%").
				WhereOr("origin_country LIKE ?", "%, "+c)
		})
	}
	if filters.Unrated {
		q = q.WhereGroup(" AND ", func(q *bun.SelectQuery) *bun.SelectQuery {
			return q.Where("bf_rating IS NULL").WhereOr("gf_rating IS NULL")
		})
	}

	switch filters.Sort {
	case "avg":
		q = q.OrderExpr(`
CASE
	WHEN bf_rating IS NULL AND gf_rating IS NULL THEN NULL
	ELSE (COALESCE(bf_rating, 0) + COALESCE(gf_rating, 0)) * 1.0 /
		NULLIF((bf_rating IS NOT NULL) + (gf_rating IS NOT NULL), 0)
END DESC
`)
	case "bf":
		q = q.OrderExpr("bf_rating DESC")
	case "gf":
		q = q.OrderExpr("gf_rating DESC")
	case "year":
		q = q.OrderExpr("year DESC")
	case "title":
		q = q.OrderExpr("title COLLATE NOCASE ASC")
	default:
		q = q.OrderExpr("updated_at DESC")
	}

	err = q.Scan(ctx)
	return out, err
}

func (s *Store) ListAllGenres(ctx context.Context) ([]string, error) {
	var rows []string
	err := s.db.NewSelect().
		Table("shows").
		Column("genres").
		Where("genres IS NOT NULL").
		Where("genres != ''").
		Scan(ctx, &rows)
	if err != nil {
		return nil, err
	}

	seen := map[string]struct{}{}
	for _, genres := range rows {
		for _, g := range strings.Split(genres, ",") {
			g = strings.TrimSpace(g)
			if g == "" {
				continue
			}
			seen[g] = struct{}{}
		}
	}

	out := make([]string, 0, len(seen))
	for g := range seen {
		out = append(out, g)
	}

	slices.SortFunc(out, func(a, b string) int {
		return strings.Compare(strings.ToLower(a), strings.ToLower(b))
	})
	return out, nil
}

func (s *Store) ListAllCountries(ctx context.Context) ([]string, error) {
	var rows []string
	err := s.db.NewSelect().
		Table("shows").
		Column("origin_country").
		Where("origin_country IS NOT NULL").
		Where("origin_country != ''").
		Scan(ctx, &rows)
	if err != nil {
		return nil, err
	}

	seen := map[string]struct{}{}
	for _, codes := range rows {
		for _, code := range strings.Split(codes, ",") {
			code = strings.TrimSpace(code)
			if code == "" {
				continue
			}
			seen[code] = struct{}{}
		}
	}

	out := make([]string, 0, len(seen))
	for code := range seen {
		out = append(out, code)
	}

	slices.SortFunc(out, func(a, b string) int {
		return strings.Compare(strings.ToLower(a), strings.ToLower(b))
	})
	return out, nil
}

func (s *Store) ListTMDBMissing(ctx context.Context) ([]TMDBRefresh, error) {
	out := []TMDBRefresh{}
	err := s.db.NewSelect().
		Table("shows").
		Column("tmdb_id", "media_type", "status").
		Where("tmdb_rating IS NULL OR tmdb_votes IS NULL OR imdb_id IS NULL OR origin_country IS NULL OR origin_country = ''").
		Scan(ctx, &out)
	if err != nil {
		return nil, err
	}
	return out, nil
}
