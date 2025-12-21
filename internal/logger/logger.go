// Package logger provides slog helpers for the app.
package logger

import (
	"log/slog"
	"os"
)

func New(level slog.Level) *slog.Logger {
	return slog.New(slog.NewJSONHandler(os.Stderr, &slog.HandlerOptions{
		AddSource: true,
		Level:     level,
	}))
}

func Error(err error) slog.Attr {
	if err == nil {
		return slog.String("err", "nil")
	}
	return slog.String("err", err.Error())
}
