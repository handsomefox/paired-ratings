package handlers

import (
	"database/sql"
	"strings"
)

type Number interface {
	~int | ~int8 | ~int16 | ~int32 | ~int64 |
		~uint | ~uint8 | ~uint16 | ~uint32 | ~uint64 | ~uintptr |
		~float32 | ~float64
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

func splitCommaValues(v sql.Null[string]) []string {
	if !v.Valid {
		return nil
	}
	raw := strings.TrimSpace(v.V)
	if raw == "" {
		return nil
	}
	parts := strings.Split(raw, ",")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		out = append(out, part)
	}
	return out
}
