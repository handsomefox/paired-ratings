package store

import (
	"database/sql"
	"fmt"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func openTestStore(t *testing.T) *Store {
	t.Helper()
	st, err := Open(t.Context(), filepath.Join(t.TempDir(), "ratings.db"))
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, st.Close()) })
	return st
}

func addShow(t *testing.T, st *Store, m *Metadata, status Status) int64 {
	t.Helper()
	if m.MediaType == "" {
		m.MediaType = MediaMovie
	}
	if m.Title == "" {
		m.Title = fmt.Sprintf("Show %d", m.TMDBID)
	}
	id, err := st.UpsertShow(t.Context(), m, status)
	require.NoError(t, err)
	return id
}

func TestStoreLifecycle(t *testing.T) {
	ctx := t.Context()
	st := openTestStore(t)

	id := addShow(t, st, &Metadata{
		TMDBID:    1,
		Title:     "Test Movie",
		Year:      new(int64(2023)),
		Genres:    []string{"Drama", "Action", "Drama"},
		Countries: []string{"US", "fr"},
	}, StatusPlanned)

	got, err := st.GetShow(ctx, id)
	require.NoError(t, err)
	assert.Equal(t, "Test Movie", got.Title)
	assert.Equal(t, StatusPlanned, got.Status)
	assert.Equal(t, []string{"Drama", "Action"}, got.Genres)
	assert.Equal(t, []string{"US", "FR"}, got.Countries)

	require.NoError(t, st.UpdateRatings(ctx, id, &RatingsUpdate{
		BfRating:  Change[int64]{Set: true, Value: new(int64(7))},
		GfComment: Change[string]{Set: true, Value: new("Loved it")},
	}))
	rated, err := st.GetShow(ctx, id)
	require.NoError(t, err)
	assert.Equal(t, new(int64(7)), rated.BfRating)
	assert.Nil(t, rated.GfRating)
	assert.Equal(t, new("Loved it"), rated.GfComment)

	// A change that is not Set leaves the stored value alone.
	require.NoError(t, st.UpdateRatings(ctx, id, &RatingsUpdate{
		GfRating: Change[int64]{Set: true, Value: new(int64(9))},
	}))
	rated, err = st.GetShow(ctx, id)
	require.NoError(t, err)
	assert.Equal(t, new(int64(7)), rated.BfRating)
	assert.Equal(t, new(int64(9)), rated.GfRating)

	require.NoError(t, st.ClearRatings(ctx, id))
	cleared, err := st.GetShow(ctx, id)
	require.NoError(t, err)
	assert.Nil(t, cleared.BfRating)
	assert.Nil(t, cleared.GfRating)
	assert.Nil(t, cleared.GfComment)

	genres, err := st.ListGenres(ctx)
	require.NoError(t, err)
	assert.Equal(t, []string{"Action", "Drama"}, genres)
	countries, err := st.ListCountries(ctx)
	require.NoError(t, err)
	assert.Equal(t, []string{"FR", "US"}, countries)

	require.NoError(t, st.DeleteShow(ctx, id))
	_, err = st.GetShow(ctx, id)
	require.ErrorIs(t, err, ErrNotFound)
	require.ErrorIs(t, st.DeleteShow(ctx, id), ErrNotFound)
}

func TestUpsertShowKeepsWhatPeopleChanged(t *testing.T) {
	ctx := t.Context()
	st := openTestStore(t)

	meta := Metadata{TMDBID: 7, MediaType: MediaTV, Title: "Old title", Genres: []string{"Drama"}}
	id := addShow(t, st, &meta, StatusPlanned)
	require.NoError(t, st.UpdateStatus(ctx, id, StatusWatching))
	require.NoError(t, st.UpdateRatings(ctx, id, &RatingsUpdate{BfRating: Change[int64]{Set: true, Value: new(int64(8))}}))
	require.NoError(t, st.AddToWatchOrder(ctx, id))
	before, err := st.GetShow(ctx, id)
	require.NoError(t, err)

	// Adding the title again, or refreshing it, must only touch the metadata.
	meta.Title = "New title"
	meta.Genres = []string{"Comedy", "Drama"}
	again, err := st.UpsertShow(ctx, &meta, StatusPlanned)
	require.NoError(t, err)
	require.Equal(t, id, again)

	after, err := st.GetShow(ctx, id)
	require.NoError(t, err)
	assert.Equal(t, "New title", after.Title)
	assert.Equal(t, []string{"Comedy", "Drama"}, after.Genres)
	assert.Equal(t, StatusWatching, after.Status)
	assert.Equal(t, before.BfRating, after.BfRating)
	assert.Equal(t, before.WatchPriority, after.WatchPriority)
	assert.Equal(t, before.UpdatedAt, after.UpdatedAt)
	assert.Equal(t, before.CreatedAt, after.CreatedAt)
}

func TestDeleteShowRemovesItsEpisodes(t *testing.T) {
	ctx := t.Context()
	st := openTestStore(t)

	id := addShow(t, st, &Metadata{TMDBID: 1, MediaType: MediaTV, Genres: []string{"Drama"}, Countries: []string{"US"}}, StatusWatching)
	require.NoError(t, st.SyncEpisodes(ctx, id, []EpisodeMetadata{{SeasonNumber: 1, EpisodeNumber: 1}}))
	require.NoError(t, st.DeleteShow(ctx, id))

	for _, table := range []string{"episodes", "show_genres", "show_countries"} {
		var n int
		require.NoError(t, st.sqldb.QueryRowContext(ctx, "SELECT count(*) FROM "+table).Scan(&n))
		assert.Zero(t, n, table)
	}
}

func TestListShowsFiltersAndPages(t *testing.T) {
	ctx := t.Context()
	st := openTestStore(t)

	// TV lists "Sci-Fi & Fantasy" and movies list "Fantasy". A genre filter
	// must match the whole name.
	sciFi := addShow(t, st, &Metadata{TMDBID: 1, MediaType: MediaTV, Year: new(int64(2001)), Genres: []string{"Sci-Fi & Fantasy"}, Countries: []string{"GB", "US"}}, StatusWatched)
	fantasy := addShow(t, st, &Metadata{TMDBID: 2, Year: new(int64(2010)), Genres: []string{"Fantasy"}, Countries: []string{"US"}}, StatusPlanned)
	plain := addShow(t, st, &Metadata{TMDBID: 3, Year: new(int64(2020))}, StatusPlanned)
	require.NoError(t, st.UpdateRatings(ctx, sciFi, &RatingsUpdate{
		BfRating: Change[int64]{Set: true, Value: new(int64(5))},
		GfRating: Change[int64]{Set: true, Value: new(int64(5))},
	}))

	ids := func(f ListFilters) []int64 {
		t.Helper()
		shows, total, err := st.ListShows(ctx, &f)
		require.NoError(t, err)
		out := make([]int64, 0, len(shows))
		for i := range shows {
			out = append(out, shows[i].ID)
		}
		if f.PageSize == 0 {
			assert.Equal(t, int64(len(out)), total, "CountShows and ListShows disagree for %+v", f)
		}
		return out
	}

	assert.Equal(t, []int64{fantasy}, ids(ListFilters{Genre: "Fantasy"}))
	assert.Equal(t, []int64{sciFi}, ids(ListFilters{Country: "GB"}))
	assert.ElementsMatch(t, []int64{sciFi, fantasy}, ids(ListFilters{Country: "US"}))
	assert.ElementsMatch(t, []int64{fantasy, plain}, ids(ListFilters{Status: StatusPlanned}))
	assert.ElementsMatch(t, []int64{fantasy, plain}, ids(ListFilters{Unrated: true}))
	assert.Equal(t, []int64{fantasy}, ids(ListFilters{YearFrom: new(int64(2005)), YearTo: new(int64(2015))}))
	assert.Equal(t, []int64{plain, fantasy, sciFi}, ids(ListFilters{Sort: SortYear}))
	assert.Empty(t, ids(ListFilters{Sort: SortPriority}))

	// Pages never repeat or skip a row, even when every sort key ties.
	var paged []int64
	for page := 1; page <= 3; page++ {
		paged = append(paged, ids(ListFilters{Sort: SortBf, Page: page, PageSize: 1})...)
	}
	assert.ElementsMatch(t, []int64{sciFi, fantasy, plain}, paged)

	_, total, err := st.ListShows(ctx, &ListFilters{Page: 2, PageSize: 2})
	require.NoError(t, err)
	assert.Equal(t, int64(3), total)
}

func TestSetWatchOrder(t *testing.T) {
	ctx := t.Context()
	st := openTestStore(t)

	all := make([]int64, 0, 25)
	for i := range 25 {
		id := addShow(t, st, &Metadata{TMDBID: int64(i + 1)}, StatusPlanned)
		require.NoError(t, st.AddToWatchOrder(ctx, id))
		all = append(all, id)
	}

	// Moving the last show to the front keeps the other 24 behind it.
	require.NoError(t, st.SetWatchOrder(ctx, []int64{all[24]}))
	shows, _, err := st.ListShows(ctx, &ListFilters{Sort: SortPriority})
	require.NoError(t, err)
	require.Len(t, shows, 25)
	got := make([]int64, 0, len(shows))
	for i := range shows {
		got = append(got, shows[i].ID)
		assert.Equal(t, new(int64(i+1)), shows[i].WatchPriority)
	}
	assert.Equal(t, append([]int64{all[24]}, all[:24]...), got)

	// Adding a show that is already queued keeps its place.
	require.NoError(t, st.AddToWatchOrder(ctx, all[24]))
	first, err := st.GetShow(ctx, all[24])
	require.NoError(t, err)
	assert.Equal(t, new(int64(1)), first.WatchPriority)

	require.ErrorIs(t, st.SetWatchOrder(ctx, []int64{9999}), ErrNotFound)

	// A watched show leaves the queue, and its episodes count as watched.
	require.NoError(t, st.SyncEpisodes(ctx, all[0], []EpisodeMetadata{{SeasonNumber: 1, EpisodeNumber: 1}}))
	require.NoError(t, st.UpdateStatus(ctx, all[0], StatusWatched))
	watched, err := st.GetShow(ctx, all[0])
	require.NoError(t, err)
	assert.Nil(t, watched.WatchPriority)
	episodes, err := st.ListEpisodes(ctx, all[0])
	require.NoError(t, err)
	assert.True(t, episodes[0].Watched)
}

func TestLibraryIDsAndStaleShows(t *testing.T) {
	ctx := t.Context()
	st := openTestStore(t)

	movie := addShow(t, st, &Metadata{TMDBID: 2, MediaType: MediaMovie}, StatusPlanned)
	tv := addShow(t, st, &Metadata{TMDBID: 2, MediaType: MediaTV}, StatusPlanned)

	library, err := st.LibraryIDs(ctx, []TMDBRef{{ID: 2, MediaType: MediaTV}, {ID: 3, MediaType: MediaTV}})
	require.NoError(t, err)
	assert.Equal(t, tv, library[TMDBRef{ID: 2, MediaType: MediaTV}])
	assert.Equal(t, movie, library[TMDBRef{ID: 2, MediaType: MediaMovie}])
	assert.NotContains(t, library, TMDBRef{ID: 3, MediaType: MediaTV})

	// The upsert stamped tmdb_refreshed_at, and a rating edit must not move it.
	require.NoError(t, st.UpdateRatings(ctx, tv, &RatingsUpdate{BfRating: Change[int64]{Set: true, Value: new(int64(8))}}))
	fresh, err := st.ListStaleShows(ctx, "2000-01-01T00:00:00Z")
	require.NoError(t, err)
	assert.Empty(t, fresh)
	stale, err := st.ListStaleShows(ctx, "2999-01-01T00:00:00Z")
	require.NoError(t, err)
	assert.Len(t, stale, 2)
}

func TestOpenRefusesLegacySchema(t *testing.T) {
	path := filepath.Join(t.TempDir(), "legacy.db")
	legacy, err := sql.Open("sqlite", path)
	require.NoError(t, err)
	_, err = legacy.ExecContext(t.Context(), `CREATE TABLE shows (id INTEGER PRIMARY KEY, genres TEXT)`)
	require.NoError(t, err)
	require.NoError(t, legacy.Close())

	_, err = Open(t.Context(), path)
	require.ErrorContains(t, err, "schema from before")
}

func TestSchemaRejectsInvalidValues(t *testing.T) {
	ctx := t.Context()
	st := openTestStore(t)
	id := addShow(t, st, &Metadata{TMDBID: 1}, StatusPlanned)

	err := st.UpdateRatings(ctx, id, &RatingsUpdate{BfRating: Change[int64]{Set: true, Value: new(int64(11))}})
	require.Error(t, err)
	require.Error(t, st.UpdateStatus(ctx, id, "dropped"))
	_, err = st.UpsertShow(ctx, &Metadata{TMDBID: 2, MediaType: "book", Title: "x"}, StatusPlanned)
	require.Error(t, err)
}
