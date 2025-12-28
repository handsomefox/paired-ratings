// Package logger provides slog helpers and formatting.
package logger

import (
	"log/slog"
	"os"
	"strings"
	"time"
)

func New(level slog.Level) *slog.Logger {
	return slog.New(slog.NewJSONHandler(os.Stderr, &slog.HandlerOptions{
		AddSource: true,
		Level:     level,
		ReplaceAttr: func(groups []string, a slog.Attr) slog.Attr {
			if a.Key == "source" {
				if v, ok := a.Value.Any().(*slog.Source); ok {
					v.Function = strings.TrimPrefix(v.Function, "github.com/handsomefox/paired-ratings/backend")
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

const (
	KeyRequestID = "request_id"
	KeyMethod    = "http_method"
	KeyPath      = "http_path"
	KeyStatus    = "status"
	KeyDuration  = "duration"
)

func RequestID(id string) slog.Attr {
	return slog.String(KeyRequestID, id)
}

func Method(method string) slog.Attr {
	return slog.String(KeyMethod, method)
}

func Path(path string) slog.Attr {
	return slog.String(KeyPath, path)
}

func Status(status int) slog.Attr {
	return slog.Int(KeyStatus, status)
}

func Duration(d time.Duration) slog.Attr {
	return slog.Duration(KeyDuration, d)
}

func Error(err error) slog.Attr {
	return slog.Any("err", err)
}
