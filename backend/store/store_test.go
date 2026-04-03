package store

import (
	"context"
	"database/sql"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestStoreLifecycle(t *testing.T) {
	ctx := context.Background()

	dbPath := t.TempDir() + "/ratings.db"
	st, err := Open(dbPath)
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, st.Close())
	})

	show := &Show{
		TMDBID:        1,
		MediaType:     "movie",
		Title:         "Test Movie",
		Year:          sql.Null[int64]{Valid: true, V: 2023},
		Genres:        sql.Null[string]{Valid: true, V: "Drama, Action"},
		OriginCountry: sql.Null[string]{Valid: true, V: "US, FR"},
		Status:        "planned",
	}

	id, err := st.UpsertShow(ctx, show)
	require.NoError(t, err)
	require.NotZero(t, id)

	got, err := st.GetShow(ctx, id)
	require.NoError(t, err)
	require.Equal(t, show.Title, got.Title)
	require.Equal(t, "planned", got.Status)

	require.NoError(t, st.UpdateWatchOrder(ctx, []int64{id}))

	prioritized, err := st.GetShow(ctx, id)
	require.NoError(t, err)
	require.True(t, prioritized.WatchPriority.Valid)
	require.Equal(t, int32(1), prioritized.WatchPriority.V)

	bfRating := sql.Null[int64]{Valid: true, V: 7}
	update := RatingsUpdate{BfRating: &bfRating}
	require.NoError(t, st.UpdateRatings(ctx, id, update))

	updated, err := st.GetShow(ctx, id)
	require.NoError(t, err)
	require.True(t, updated.BfRating.Valid)
	require.Equal(t, int64(7), updated.BfRating.V)
	require.Equal(t, "planned", updated.Status)
	require.True(t, updated.WatchPriority.Valid)

	require.NoError(t, st.ClearRatings(ctx, id))

	cleared, err := st.GetShow(ctx, id)
	require.NoError(t, err)
	require.False(t, cleared.BfRating.Valid)
	require.False(t, cleared.GfRating.Valid)

	shows, err := st.ListShows(ctx, ListFilters{Status: "all"})
	require.NoError(t, err)
	require.Len(t, shows, 1)

	genres, err := st.ListAllGenres(ctx)
	require.NoError(t, err)
	require.Contains(t, genres, "Drama")
	require.Contains(t, genres, "Action")

	countries, err := st.ListAllCountries(ctx)
	require.NoError(t, err)
	require.Contains(t, countries, "US")
	require.Contains(t, countries, "FR")
}

func TestStoreEdgeCases(t *testing.T) {
	ctx := context.Background()

	dbPath := t.TempDir() + "/ratings.db"
	st, err := Open(dbPath)
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, st.Close())
	})

	id, err := st.UpsertShow(ctx, &Show{
		TMDBID:    2,
		MediaType: "tv",
		Title:     "Edge Show",
		Status:    "planned",
	})
	require.NoError(t, err)

	require.NoError(t, st.UpdateStatus(ctx, id, "watched"))

	refs, err := st.InLibraryByTMDB(ctx, []TMDBRef{{ID: 2, MediaType: "tv"}, {ID: 2, MediaType: "tv"}})
	require.NoError(t, err)
	require.True(t, refs[TMDBRef{ID: 2, MediaType: "tv"}])

	missing, err := st.ListTMDBMissing(ctx)
	require.NoError(t, err)
	require.NotEmpty(t, missing)

	require.NoError(t, st.DeleteShow(ctx, id))
	_, err = st.GetShow(ctx, id)
	require.Error(t, err)
}
