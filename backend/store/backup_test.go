package store

import (
	"database/sql"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBackupIncludesCommittedWALData(t *testing.T) {
	ctx := t.Context()
	st, err := Open(filepath.Join(t.TempDir(), "live.db"))
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, st.Close()) })
	_, err = st.sqldb.ExecContext(ctx, "PRAGMA wal_autocheckpoint = 0")
	require.NoError(t, err)
	id, err := st.UpsertShow(ctx, &Show{TMDBID: 1, MediaType: "tv", Title: "Saved in WAL", Status: "planned"})
	require.NoError(t, err)
	rating := sql.Null[int64]{V: 8, Valid: true}
	require.NoError(t, st.UpdateRatings(ctx, id, RatingsUpdate{BfRating: &rating}))
	require.NoError(t, st.SyncEpisodes(ctx, id, []Episode{{SeasonNumber: 1, EpisodeNumber: 1, Title: "Pilot"}}))
	require.NoError(t, st.ToggleSeason(ctx, id, 1, true))

	destination := filepath.Join(t.TempDir(), "snapshot.db")
	require.NoError(t, st.Backup(ctx, destination))
	// Later writes must not change the snapshot.
	require.NoError(t, st.ClearRatings(ctx, id))
	backup, err := Open(destination)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, backup.Close()) })
	show, err := backup.GetShow(ctx, id)
	require.NoError(t, err)
	require.Equal(t, rating, show.BfRating)
	episodes, err := backup.GetEpisodes(ctx, id)
	require.NoError(t, err)
	require.Len(t, episodes, 1)
	require.True(t, episodes[0].Watched)
	var integrity string
	require.NoError(t, backup.sqldb.QueryRowContext(ctx, "PRAGMA integrity_check").Scan(&integrity))
	require.Equal(t, "ok", integrity)

	// An existing backup cannot be silently overwritten.
	require.Error(t, st.Backup(ctx, destination))
}
