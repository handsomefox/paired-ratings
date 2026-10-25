package store

import (
	"database/sql"
	"io"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// legacySchema is the production schema before the 001_schema baseline.
const legacySchema = `
CREATE TABLE shows (
	id INTEGER PRIMARY KEY AUTOINCREMENT, tmdb_id INTEGER NOT NULL, media_type TEXT NOT NULL,
	title TEXT NOT NULL, year INTEGER, genres TEXT, overview TEXT, poster_path TEXT,
	imdb_id TEXT, tmdb_rating REAL, tmdb_votes INTEGER, status TEXT NOT NULL,
	bf_rating INTEGER, gf_rating INTEGER, bf_comment TEXT, gf_comment TEXT,
	created_at TEXT NOT NULL, updated_at TEXT NOT NULL, origin_country TEXT,
	watch_priority INTEGER, collection_id INTEGER, collection_name TEXT,
	tmdb_refreshed_at TEXT, UNIQUE(tmdb_id, media_type));
CREATE TABLE episodes (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	show_id INTEGER NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
	season_number INTEGER NOT NULL, episode_number INTEGER NOT NULL, title TEXT,
	overview TEXT, air_date TEXT, runtime INTEGER, updated_at TEXT NOT NULL,
	watched INTEGER NOT NULL DEFAULT 0, UNIQUE(show_id, season_number, episode_number));
INSERT INTO shows VALUES
	(3, 100, 'tv', 'Better Call Saul', 2015, 'Crime, Drama', 'Jimmy.', '/p.jpg', 'tt3032476',
		8.7, 6827, 'watching', NULL, NULL, '', 'Gf note', '2025-12-22T14:50:37Z',
		'2026-09-05T21:21:28Z', 'US', 1, NULL, NULL, '2026-09-05T21:21:28Z'),
	(9, 200, 'movie', 'Mickey 17', 2025, 'Sci-Fi & Fantasy, Comedy', NULL, NULL, NULL,
		NULL, NULL, 'watched', 7, 9, 'Bf note', '', '2025-12-23T10:00:00Z',
		'2025-12-24T10:00:00Z', 'GB, US', NULL, 55, 'Collection', NULL);
INSERT INTO episodes VALUES
	(1, 3, 1, 1, 'Uno', 'unused', '2015-02-08', 53, '2026-01-01T00:00:00Z', 1),
	(2, 3, 1, 2, '', NULL, '', 0, '2026-01-01T00:00:00Z', 0),
	(5, 42, 1, 1, 'Orphan of a deleted show', NULL, NULL, NULL, '2026-01-01T00:00:00Z', 1);
`

func TestConvertLegacy(t *testing.T) {
	ctx := t.Context()
	dir := t.TempDir()
	src := filepath.Join(dir, "legacy.db")
	legacy, err := sql.Open("sqlite", src)
	require.NoError(t, err)
	_, err = legacy.ExecContext(ctx, legacySchema)
	require.NoError(t, err)
	require.NoError(t, legacy.Close())

	dst := filepath.Join(dir, "new.db")
	report, err := ConvertLegacy(ctx, src, dst)
	require.NoError(t, err)
	assert.Equal(t, &LegacyReport{Shows: 2, Episodes: 2, OrphanEpisodes: 1, EmptyComments: 2}, report)

	// The result is one self-contained file.
	for _, suffix := range []string{"-wal", "-shm", "-journal"} {
		assert.NoFileExists(t, dst+suffix)
	}
	_, err = ConvertLegacy(ctx, src, dst)
	require.ErrorContains(t, err, "already exists")

	st, err := Open(t.Context(), dst)
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, st.Close()) })

	saul, err := st.GetShow(ctx, 3)
	require.NoError(t, err)
	assert.Equal(t, []string{"Crime", "Drama"}, saul.Genres)
	assert.Equal(t, []string{"US"}, saul.Countries)
	assert.Nil(t, saul.BfComment)
	assert.Equal(t, new("Gf note"), saul.GfComment)
	assert.Equal(t, new(int64(1)), saul.WatchPriority)
	assert.Equal(t, "2026-09-05T21:21:28Z", saul.UpdatedAt)

	mickey, err := st.GetShow(ctx, 9)
	require.NoError(t, err)
	assert.Equal(t, []string{"Sci-Fi & Fantasy", "Comedy"}, mickey.Genres)
	assert.Equal(t, []string{"GB", "US"}, mickey.Countries)
	assert.Equal(t, new(int64(7)), mickey.BfRating)
	assert.Equal(t, new(int64(9)), mickey.GfRating)
	assert.Nil(t, mickey.GfComment)
	assert.Equal(t, neverRefreshed, mickey.TMDBRefreshedAt)

	episodes, err := st.ListEpisodes(ctx, 3)
	require.NoError(t, err)
	require.Len(t, episodes, 2)
	assert.True(t, episodes[0].Watched)
	assert.Equal(t, new(int64(53)), episodes[0].Runtime)
	assert.Nil(t, episodes[1].Title)
	assert.Nil(t, episodes[1].AirDate)
	assert.Nil(t, episodes[1].Runtime)

	// New rows continue after the copied ids instead of reusing them.
	id := addShow(t, st, &Metadata{TMDBID: 300}, StatusPlanned)
	assert.Greater(t, id, int64(9))
}

// TestConvertLegacyFile converts a real database. Point LEGACY_DB at a local
// copy of the production file to run it; it never writes to that file.
func TestConvertLegacyFile(t *testing.T) {
	path := os.Getenv("LEGACY_DB")
	if path == "" {
		t.Skip("set LEGACY_DB to a copy of a legacy database")
	}

	// Work on a copy: opening a WAL database can checkpoint it.
	dir := t.TempDir()
	src := filepath.Join(dir, "legacy.db")
	for _, suffix := range []string{"", "-wal"} {
		copyFile(t, path+suffix, src+suffix)
	}

	report, err := ConvertLegacy(t.Context(), src, filepath.Join(dir, "new.db"))
	require.NoError(t, err)
	t.Logf("%+v", *report)
}

func copyFile(t *testing.T, from, to string) {
	t.Helper()
	in, err := os.Open(from) //nolint:gosec // Test input chosen by whoever runs the test.
	if os.IsNotExist(err) {
		return
	}
	require.NoError(t, err)
	defer func() { require.NoError(t, in.Close()) }()
	out, err := os.Create(to) //nolint:gosec // Path inside t.TempDir.
	require.NoError(t, err)
	defer func() { require.NoError(t, out.Close()) }()
	_, err = io.Copy(out, in)
	require.NoError(t, err)
}
