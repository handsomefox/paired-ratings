package handlers

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoadSessionKey(t *testing.T) {
	path := filepath.Join(t.TempDir(), "data", "session.key")

	created, err := LoadSessionKey(path)
	require.NoError(t, err)
	assert.Len(t, created, sessionKeySize)
	info, err := os.Stat(path)
	require.NoError(t, err)
	assert.Equal(t, os.FileMode(0o600), info.Mode().Perm())

	// The key survives a restart, so sessions do too.
	reused, err := LoadSessionKey(path)
	require.NoError(t, err)
	assert.Equal(t, created, reused)

	require.NoError(t, os.WriteFile(path, []byte("short"), 0o600))
	_, err = LoadSessionKey(path)
	require.ErrorContains(t, err, "has 5 bytes")
}
