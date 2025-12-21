// Package logger provides slog helpers and formatting.
package logger

import (
	"log/slog"
	"os"
	"strings"
)

func New(level slog.Level) *slog.Logger {
	return slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{
		AddSource: true,
		Level:     level,
		ReplaceAttr: func(groups []string, a slog.Attr) slog.Attr {
			if a.Key == "source" {
				if v, ok := a.Value.Any().(*slog.Source); ok {
					v.Function = strings.TrimPrefix(v.Function, "github.com/handsomefox/website-rating/")
					parts := strings.Split(v.File, "/")
					if len(parts) > 4 {
						parts = parts[len(parts)-4:]
					}
					v.File = strings.Join(parts, "/")
				}
			}
			return a
		},
	}))
}

func Error(err error) slog.Attr {
	if err == nil {
		return slog.String("err", "nil")
	}

	return slog.String("err", err.Error())
}
