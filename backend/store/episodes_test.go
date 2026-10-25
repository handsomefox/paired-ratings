package store

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSyncEpisodesPreservesProgress(t *testing.T) {
	ctx := t.Context()
	st := openTestStore(t)
	showID := addShow(t, st, &Metadata{TMDBID: 1, MediaType: MediaTV}, StatusWatching)
	otherID := addShow(t, st, &Metadata{TMDBID: 2, MediaType: MediaTV}, StatusPlanned)

	require.NoError(t, st.SyncEpisodes(ctx, showID, []EpisodeMetadata{
		{SeasonNumber: 1, EpisodeNumber: 1, Title: new("Original")},
		{SeasonNumber: 2, EpisodeNumber: 1},
	}))
	stored, err := st.ListEpisodes(ctx, showID)
	require.NoError(t, err)
	require.Len(t, stored, 2)
	assert.False(t, stored[0].Watched)
	require.NoError(t, st.SetEpisodeWatched(ctx, stored[0].ID, true))

	require.NoError(t, st.SyncEpisodes(ctx, showID, []EpisodeMetadata{
		{SeasonNumber: 1, EpisodeNumber: 1, Title: new("Updated")},
	}))
	stored, err = st.ListEpisodes(ctx, showID)
	require.NoError(t, err)
	require.Len(t, stored, 2)
	assert.Equal(t, new("Updated"), stored[0].Title)
	assert.True(t, stored[0].Watched)

	seasons, err := st.CountSeasons(ctx, showID)
	require.NoError(t, err)
	assert.Equal(t, int64(2), seasons)

	require.NoError(t, st.SetSeasonWatched(ctx, showID, 2, true))
	counts, err := st.EpisodeCounts(ctx, []int64{showID, otherID})
	require.NoError(t, err)
	assert.Equal(t, EpisodeCounts{Total: 2, Watched: 2}, counts[showID])
	assert.NotContains(t, counts, otherID)

	require.ErrorIs(t, st.SetSeasonWatched(ctx, showID, 9, true), ErrNotFound)
	require.ErrorIs(t, st.SetEpisodeWatched(ctx, 9999, true), ErrNotFound)

	other, err := st.ListEpisodes(ctx, otherID)
	require.NoError(t, err)
	assert.Empty(t, other)
}
