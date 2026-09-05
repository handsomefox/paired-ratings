package handlers

import (
	"context"
	"errors"
	"testing"

	"github.com/handsomefox/paired-ratings/backend/store"
	"github.com/handsomefox/paired-ratings/backend/tmdb"
	"github.com/stretchr/testify/require"
)

func TestSyncAllSeasonsReportsPartialFailure(t *testing.T) {
	st, err := store.Open(t.TempDir() + "/ratings.db")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, st.Close()) })
	showID, err := st.UpsertShow(t.Context(), &store.Show{TMDBID: 1, MediaType: "tv", Title: "Show", Status: "planned"})
	require.NoError(t, err)
	fetchErr := errors.New("TMDB unavailable")
	var calls []int
	h := newTestHandlerWithTMDB(t, st, &tmdb.Mock{
		FetchSeasonFunc: func(_ context.Context, _ int64, season int) (tmdb.Season, error) {
			calls = append(calls, season)
			if season == 1 {
				return tmdb.Season{}, fetchErr
			}
			return tmdb.Season{Episodes: []tmdb.Episode{{SeasonNumber: season, EpisodeNumber: 1}}}, nil
		},
	})
	err = h.syncAllSeasons(t.Context(), showID, 1, 2, false)
	require.ErrorIs(t, err, fetchErr)
	require.ErrorContains(t, err, "season 1")
	require.Equal(t, []int{1, 2}, calls)
	episodes, err := st.GetEpisodes(t.Context(), showID)
	require.NoError(t, err)
	require.Len(t, episodes, 1)
	require.Equal(t, 2, episodes[0].SeasonNumber)
}

func TestSyncAllSeasonsStopsOnCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	calls := 0
	h := &Handler{tmdb: &tmdb.Mock{
		FetchSeasonFunc: func(_ context.Context, _ int64, _ int) (tmdb.Season, error) {
			calls++
			cancel()
			return tmdb.Season{}, ctx.Err()
		},
	}}
	require.ErrorIs(t, h.syncAllSeasons(ctx, 1, 1, 10, false), context.Canceled)
	require.Equal(t, 1, calls)
}
