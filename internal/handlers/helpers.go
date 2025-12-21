package handlers

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"math"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"
)

type Number interface {
	~int | ~int8 | ~int16 | ~int32 | ~int64 |
		~uint | ~uint8 | ~uint16 | ~uint32 | ~uint64 | ~uintptr |
		~float32 | ~float64
}

func hashPassword(password string) string {
	sum := sha256.Sum256([]byte(password))
	return hex.EncodeToString(sum[:])
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)

	if payload == nil {
		return
	}

	if err := json.NewEncoder(w).Encode(payload); err != nil {
		slog.Warn("write json failed", slog.Any("err", err))
	}
}

func decodeJSON(r *http.Request, dst any) error {
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return err
	}
	if err := dec.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		if err == nil {
			return errors.New("unexpected trailing json")
		}
		return err
	}
	return nil
}

func idParam(r *http.Request, name string) (int64, error) {
	raw := chi.URLParam(r, name)
	if raw == "" {
		return 0, errors.New("missing id")
	}
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || id <= 0 {
		return 0, errors.New("bad id")
	}
	return id, nil
}

func isNoRows(err error) bool {
	return errors.Is(err, sql.ErrNoRows)
}

func badRequest(msg string) error   { return &Error{Status: http.StatusBadRequest, Message: msg} }
func unauthorized(msg string) error { return &Error{Status: http.StatusUnauthorized, Message: msg} }
func notFound(msg string) error     { return &Error{Status: http.StatusNotFound, Message: msg} }
func internal(err error) error      { return err }

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

func toSQLNullNumeric[T Number](val T) sql.Null[T] {
	return sql.Null[T]{Valid: val > 0, V: val}
}

func toSQLNullString(val string) sql.Null[string] {
	val = strings.TrimSpace(val)
	if val == "" {
		return sql.Null[string]{}
	}
	return sql.Null[string]{Valid: true, V: val}
}

func fromSQLNull[T any](v sql.Null[T]) *T {
	if v.Valid {
		return &v.V
	}
	return nil
}

func ptr[T any](v T) *T { return &v }

func toInt32(val int) int32 {
	if val > math.MaxInt32 {
		slog.Warn("OVERFLOW CONVERSION")
		return math.MaxInt32
	}
	if val < math.MinInt32 {
		slog.Warn("UNDERFLOW CONVERSION")
		return math.MinInt32
	}
	return int32(val)
}
