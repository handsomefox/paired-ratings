package store

import (
	"context"
	"slices"
	"strings"

	"github.com/uptrace/bun"
)

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

func (s *Store) ListShows(ctx context.Context, filters *ListFilters) (out []Show, err error) {
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
	case "priority":
		q = q.OrderExpr("CASE WHEN watch_priority IS NULL THEN 1 ELSE 0 END ASC").
			OrderExpr("watch_priority ASC").
			OrderExpr("updated_at DESC")
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
		for g := range strings.SplitSeq(genres, ",") {
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
		for code := range strings.SplitSeq(codes, ",") {
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
