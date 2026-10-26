package store

import (
	"context"
	"slices"
	"strings"
	"time"

	"github.com/handsomefox/paired-ratings/backend/gen/db"
)

// Timestamps are stored as RFC 3339 text in UTC, which sorts in time order.
func formatTime(t time.Time) string {
	return t.UTC().Format(time.RFC3339)
}

func nowUTC() string {
	return formatTime(time.Now())
}

// UpsertShow adds a show with the given status. Adding a show that is already
// in the library refreshes its metadata and keeps its status, ratings,
// comments, watch order and updated_at.
func (s *Store) UpsertShow(ctx context.Context, m *Metadata, status Status) (int64, error) {
	var id int64
	err := s.inTx(ctx, func(q *db.Queries) error {
		var err error
		id, err = q.UpsertShow(ctx, db.UpsertShowParams{
			TMDBID:         m.TMDBID,
			MediaType:      string(m.MediaType),
			Title:          m.Title,
			Year:           m.Year,
			Overview:       m.Overview,
			PosterPath:     m.PosterPath,
			IMDbID:         m.IMDbID,
			TMDBRating:     m.TMDBRating,
			TMDBVotes:      m.TMDBVotes,
			CollectionID:   m.CollectionID,
			CollectionName: m.CollectionName,
			Status:         string(status),
			Now:            nowUTC(),
		})
		if err != nil {
			return err
		}
		return replaceGenresAndCountries(ctx, q, id, m.Genres, m.Countries)
	})
	return id, err
}

// RefreshShow replaces the TMDB metadata of the show m names. It returns
// ErrNotFound if that show is not in the library.
func (s *Store) RefreshShow(ctx context.Context, m *Metadata) error {
	return s.inTx(ctx, func(q *db.Queries) error {
		id, err := q.UpdateShowMetadata(ctx, db.UpdateShowMetadataParams{
			Title:          m.Title,
			Year:           m.Year,
			Overview:       m.Overview,
			PosterPath:     m.PosterPath,
			IMDbID:         m.IMDbID,
			TMDBRating:     m.TMDBRating,
			TMDBVotes:      m.TMDBVotes,
			CollectionID:   m.CollectionID,
			CollectionName: m.CollectionName,
			Now:            nowUTC(),
			TMDBID:         m.TMDBID,
			MediaType:      string(m.MediaType),
		})
		if err != nil {
			return notFound(err)
		}
		return replaceGenresAndCountries(ctx, q, id, m.Genres, m.Countries)
	})
}

// replaceGenresAndCountries stores the lists in order. Country codes are
// upper-cased, and a repeated value keeps its first position.
func replaceGenresAndCountries(ctx context.Context, q *db.Queries, showID int64, genres, countries []string) error {
	if err := q.DeleteShowGenres(ctx, showID); err != nil {
		return err
	}
	for i, name := range distinct(genres) {
		err := q.InsertShowGenre(ctx, db.InsertShowGenreParams{ShowID: showID, Position: int64(i), Name: name})
		if err != nil {
			return err
		}
	}

	if err := q.DeleteShowCountries(ctx, showID); err != nil {
		return err
	}
	for i, code := range distinct(upper(countries)) {
		err := q.InsertShowCountry(ctx, db.InsertShowCountryParams{ShowID: showID, Position: int64(i), Code: code})
		if err != nil {
			return err
		}
	}
	return nil
}

func distinct(values []string) []string {
	out := make([]string, 0, len(values))
	for _, v := range values {
		if !slices.Contains(out, v) {
			out = append(out, v)
		}
	}
	return out
}

func upper(values []string) []string {
	out := make([]string, len(values))
	for i, v := range values {
		out[i] = strings.ToUpper(v)
	}
	return out
}

func (s *Store) GetShow(ctx context.Context, id int64) (Show, error) {
	row, err := s.q.GetShow(ctx, id)
	if err != nil {
		return Show{}, notFound(err)
	}
	shows, err := s.withGenresAndCountries(ctx, []db.Show{row})
	if err != nil {
		return Show{}, err
	}
	return shows[0], nil
}

// ListShows returns one page of shows and the number of matches across all
// pages.
func (s *Store) ListShows(ctx context.Context, f *ListFilters) (shows []Show, total int64, err error) {
	limit, offset := int64(-1), int64(0)
	if f.PageSize > 0 {
		limit = int64(f.PageSize)
		offset = int64(max(f.Page, 1)-1) * limit
	}
	unrated := int64(0)
	if f.Unrated {
		unrated = 1
	}

	total, err = s.q.CountShows(ctx, db.CountShowsParams{
		Sort:     string(f.Sort),
		Status:   string(f.Status),
		YearFrom: f.YearFrom,
		YearTo:   f.YearTo,
		Genre:    f.Genre,
		Country:  f.Country,
		Unrated:  unrated,
	})
	if err != nil {
		return nil, 0, err
	}

	rows, err := s.q.ListShows(ctx, db.ListShowsParams{
		Sort:      string(f.Sort),
		Status:    string(f.Status),
		YearFrom:  f.YearFrom,
		YearTo:    f.YearTo,
		Genre:     f.Genre,
		Country:   f.Country,
		Unrated:   unrated,
		RowLimit:  limit,
		RowOffset: offset,
	})
	if err != nil {
		return nil, 0, err
	}

	shows, err = s.withGenresAndCountries(ctx, rows)
	return shows, total, err
}

func (s *Store) withGenresAndCountries(ctx context.Context, rows []db.Show) ([]Show, error) {
	shows := make([]Show, len(rows))
	ids := make([]int64, len(rows))
	index := make(map[int64]int, len(rows))
	for i := range rows {
		shows[i] = showFromRow(&rows[i])
		ids[i] = rows[i].ID
		index[rows[i].ID] = i
	}
	if len(ids) == 0 {
		return shows, nil
	}

	genres, err := s.q.ListGenresForShows(ctx, ids)
	if err != nil {
		return nil, err
	}
	for _, g := range genres {
		show := &shows[index[g.ShowID]]
		show.Genres = append(show.Genres, g.Name)
	}

	countries, err := s.q.ListCountriesForShows(ctx, ids)
	if err != nil {
		return nil, err
	}
	for _, c := range countries {
		show := &shows[index[c.ShowID]]
		show.Countries = append(show.Countries, c.Code)
	}
	return shows, nil
}

func showFromRow(r *db.Show) Show {
	return Show{
		Metadata: Metadata{
			TMDBID:         r.TMDBID,
			MediaType:      MediaType(r.MediaType),
			Title:          r.Title,
			Year:           r.Year,
			Overview:       r.Overview,
			PosterPath:     r.PosterPath,
			IMDbID:         r.IMDbID,
			TMDBRating:     r.TMDBRating,
			TMDBVotes:      r.TMDBVotes,
			CollectionID:   r.CollectionID,
			CollectionName: r.CollectionName,
		},
		ID:            r.ID,
		Status:        Status(r.Status),
		WatchPriority: r.WatchPriority,
		BfRating:      r.BfRating,
		GfRating:      r.GfRating,
		BfComment:     r.BfComment,
		GfComment:     r.GfComment,
		CreatedAt:     r.CreatedAt,
		UpdatedAt:     r.UpdatedAt,
	}
}

// ListGenres returns every genre used in the library.
func (s *Store) ListGenres(ctx context.Context) ([]string, error) {
	return s.q.ListDistinctGenres(ctx)
}

// ListCountries returns every origin country code used in the library.
func (s *Store) ListCountries(ctx context.Context) ([]string, error) {
	return s.q.ListDistinctCountries(ctx)
}

// LibraryIDs maps each TMDB title that is in the library to its show id.
func (s *Store) LibraryIDs(ctx context.Context, refs []TMDBRef) (map[TMDBRef]int64, error) {
	out := make(map[TMDBRef]int64, len(refs))
	if len(refs) == 0 {
		return out, nil
	}

	tmdbIDs := make([]int64, 0, len(refs))
	for _, ref := range refs {
		tmdbIDs = append(tmdbIDs, ref.ID)
	}
	rows, err := s.q.ShowsByTMDBIDs(ctx, tmdbIDs)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		out[TMDBRef{ID: row.TMDBID, MediaType: MediaType(row.MediaType)}] = row.ID
	}
	return out, nil
}

func (s *Store) UpdateRatings(ctx context.Context, id int64, u *RatingsUpdate) error {
	return expectAffected(s.q.UpdateRatings(ctx, db.UpdateRatingsParams{
		SetBfRating:  flag(u.BfRating.Set),
		BfRating:     u.BfRating.Value,
		SetGfRating:  flag(u.GfRating.Set),
		GfRating:     u.GfRating.Value,
		SetBfComment: flag(u.BfComment.Set),
		BfComment:    u.BfComment.Value,
		SetGfComment: flag(u.GfComment.Set),
		GfComment:    u.GfComment.Value,
		Now:          nowUTC(),
		ID:           id,
	}))
}

func flag(b bool) int64 {
	if b {
		return 1
	}
	return 0
}

func (s *Store) ClearRatings(ctx context.Context, id int64) error {
	return expectAffected(s.q.ClearRatings(ctx, db.ClearRatingsParams{Now: nowUTC(), ID: id}))
}

// UpdateStatus sets the status. Marking a show watched also takes it out of the
// watch order and marks every stored episode watched.
func (s *Store) UpdateStatus(ctx context.Context, id int64, status Status) error {
	return s.inTx(ctx, func(q *db.Queries) error {
		now := nowUTC()
		err := expectAffected(q.UpdateStatus(ctx, db.UpdateStatusParams{Status: string(status), Now: now, ID: id}))
		if err != nil || status != StatusWatched {
			return err
		}
		return q.SetAllEpisodesWatched(ctx, db.SetAllEpisodesWatchedParams{Now: now, ShowID: id})
	})
}

// SetWatchOrder puts the given shows first, in order, and keeps every other
// show already in the watch order after them in its current order.
func (s *Store) SetWatchOrder(ctx context.Context, orderedIDs []int64) error {
	return s.inTx(ctx, func(q *db.Queries) error {
		current, err := q.ListWatchOrder(ctx)
		if err != nil {
			return err
		}

		order := make([]int64, 0, len(orderedIDs)+len(current))
		seen := make(map[int64]bool, len(orderedIDs)+len(current))
		for _, id := range slices.Concat(orderedIDs, current) {
			if !seen[id] {
				seen[id] = true
				order = append(order, id)
			}
		}

		for i, id := range order {
			priority := int64(i + 1)
			err := expectAffected(q.SetWatchPriority(ctx, db.SetWatchPriorityParams{WatchPriority: &priority, ID: id}))
			if err != nil {
				return err
			}
		}
		return nil
	})
}

func (s *Store) AddToWatchOrder(ctx context.Context, id int64) error {
	return expectAffected(s.q.AddToWatchOrder(ctx, db.AddToWatchOrderParams{Now: nowUTC(), ID: id}))
}

func (s *Store) RemoveFromWatchOrder(ctx context.Context, id int64) error {
	return expectAffected(s.q.RemoveFromWatchOrder(ctx, db.RemoveFromWatchOrderParams{Now: nowUTC(), ID: id}))
}

// DeleteShow deletes the show with its genres, countries and episodes.
func (s *Store) DeleteShow(ctx context.Context, id int64) error {
	return expectAffected(s.q.DeleteShow(ctx, id))
}

// ListStaleShows returns the shows whose TMDB metadata was pulled before the
// given time.
func (s *Store) ListStaleShows(ctx context.Context, before time.Time) ([]StaleShow, error) {
	rows, err := s.q.ListStaleShows(ctx, formatTime(before))
	if err != nil {
		return nil, err
	}
	out := make([]StaleShow, 0, len(rows))
	for _, r := range rows {
		out = append(out, StaleShow{
			Ref:         TMDBRef{ID: r.TMDBID, MediaType: MediaType(r.MediaType)},
			ShowID:      r.ID,
			HasEpisodes: r.HasEpisodes != 0,
		})
	}
	return out, nil
}
