// Package logger provides slog helpers for the app.
package logger

import (
	"context"
	"fmt"
	"log/slog"
	"os"
)

type ExitOnLevel struct {
	lvl slog.Level
	slog.Handler
}

func NewExitOnLevelLogger(level slog.Level) *slog.Logger {
	return slog.New(&ExitOnLevel{
		lvl: level,
		Handler: slog.NewJSONHandler(os.Stderr, &slog.HandlerOptions{
			AddSource: true,
			Level:     slog.LevelDebug,
		}),
	})
}

//nolint:gocritic // slog.Handler requires Record by value.
func (h *ExitOnLevel) Handle(ctx context.Context, r slog.Record) error {
	if r.Level == h.lvl {
		fmt.Println("Level exit triggered")
		os.Exit(1)
	}

	return h.Handler.Handle(ctx, r)
}

func Error(err error) slog.Attr {
	if err == nil {
		return slog.String("err", "nil")
	}
	return slog.String("err", err.Error())
}
