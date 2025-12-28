package handlers

import (
	"database/sql"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestImdbURL(t *testing.T) {
	require.Empty(t, imdbURL(sql.Null[string]{}))
	require.Equal(t, "https://www.imdb.com/title/tt1234/", imdbURL(sql.Null[string]{Valid: true, V: "tt1234"}))
}

func TestOptionalString(t *testing.T) {
	require.Nil(t, optionalString(""))
	val := optionalString(" ok ")
	require.NotNil(t, val)
	require.Equal(t, "ok", *val)
}

func TestValueOrDefault(t *testing.T) {
	require.Equal(t, 0, valueOrDefault[int](nil))
	v := 42
	require.Equal(t, 42, valueOrDefault(&v))
}

func TestToSQLNullNumeric(t *testing.T) {
	n := toSQLNullNumeric(0)
	require.False(t, n.Valid)
	n = toSQLNullNumeric(5)
	require.True(t, n.Valid)
	require.Equal(t, 5, n.V)
}

func TestToSQLNullString(t *testing.T) {
	require.False(t, toSQLNullString(" ").Valid)
	val := toSQLNullString(" ok ")
	require.True(t, val.Valid)
	require.Equal(t, "ok", val.V)
}

func TestFromSQLNull(t *testing.T) {
	val := fromSQLNull(sql.Null[string]{Valid: true, V: "hi"})
	require.NotNil(t, val)
	require.Equal(t, "hi", *val)
	val = fromSQLNull(sql.Null[string]{})
	require.Nil(t, val)
}

func TestSplitCommaValues(t *testing.T) {
	vals := splitCommaValues(sql.Null[string]{Valid: true, V: "a, b, ,c"})
	require.Equal(t, []string{"a", "b", "c"}, vals)
}
