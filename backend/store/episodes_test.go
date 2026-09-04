package store

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSyncEpisodesUsesTargetShowAndPreservesProgress(t *testing.T) {
	ctx := t.Context()
	st, err := Open(t.TempDir() + "/ratings.db")
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, st.Close()) })
	showID, err := st.UpsertShow(ctx, &Show{TMDBID: 1, MediaType: "tv", Title: "Target", Status: "watching"})
	require.NoError(t, err)
	otherID, err := st.UpsertShow(ctx, &Show{TMDBID: 2, MediaType: "tv", Title: "Other", Status: "planned"})
	require.NoError(t, err)

	episodes := []Episode{{ShowID: otherID, SeasonNumber: 1, EpisodeNumber: 1, Title: "Original"}}
	require.NoError(t, st.SyncEpisodes(ctx, showID, episodes))
	stored, err := st.GetEpisodes(ctx, showID)
	require.NoError(t, err)
	require.Len(t, stored, 1)
	require.False(t, stored[0].Watched)
	require.NoError(t, st.ToggleEpisode(ctx, stored[0].ID, true))

	episodes[0].ShowID = 0
	episodes[0].Title = "Updated"
	require.NoError(t, st.SyncEpisodes(ctx, showID, episodes))
	stored, err = st.GetEpisodes(ctx, showID)
	require.NoError(t, err)
	require.Len(t, stored, 1)
	require.Equal(t, "Updated", stored[0].Title)
	require.True(t, stored[0].Watched)
	otherEpisodes, err := st.GetEpisodes(ctx, otherID)
	require.NoError(t, err)
	require.Empty(t, otherEpisodes)
}
