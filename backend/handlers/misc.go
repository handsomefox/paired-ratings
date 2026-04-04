package handlers

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"strings"
)

func hashPassword(password string) string {
	sum := sha256.Sum256([]byte(password))
	return hex.EncodeToString(sum[:])
}

func imdbURL(id sql.Null[string]) string {
	if !id.Valid || strings.TrimSpace(id.V) == "" {
		return ""
	}
	return "https://www.imdb.com/title/" + strings.TrimSpace(id.V) + "/"
}

func valueOrDefault[T any](val *T) T {
	if val == nil {
		var v T
		return v
	}
	return *val
}

func optionalString(val string) *string {
	val = strings.TrimSpace(val)
	if val == "" {
		return nil
	}
	return &val
}
