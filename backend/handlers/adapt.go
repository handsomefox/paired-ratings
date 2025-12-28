package handlers

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5/middleware"
	"github.com/handsomefox/paired-ratings/backend/gen/pb"
	"github.com/handsomefox/paired-ratings/backend/logger"
)

type HandlerWithErr func(w http.ResponseWriter, r *http.Request) error

type Error struct {
	Status  int
	Message string
}

func (e Error) Error() string {
	return e.Message + " code=" + strconv.FormatInt(int64(e.Status), 10)
}

func Adapt(h HandlerWithErr, options ...Option) http.Handler {
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		if err := h(w, r); err != nil {
			status := http.StatusInternalServerError
			message := err.Error()

			var statusErr *Error
			if errors.As(err, &statusErr) {
				status = statusErr.Status
				message = statusErr.Message
			}

			logRequest(r, start, status, err)
			writeJSON(w, status, &pb.ErrorResponse{Error: message})
			return
		}

		logRequest(r, start, http.StatusOK, nil)
	})

	return applyOptions(handler, options...)
}

type Option func(handler http.Handler) http.Handler

func WithCompression(handler http.Handler) http.Handler {
	compressor := middleware.Compress(5, "application/json")
	return compressor(handler)
}

func applyOptions(h http.HandlerFunc, options ...Option) http.Handler {
	var handler http.Handler = h
	for _, option := range options {
		handler = option(handler)
	}
	return handler
}

func logRequest(r *http.Request, start time.Time, status int, err error) {
	if r.URL.Path == "/ping" {
		return
	}

	logAttrs := []slog.Attr{
		logger.Status(status),
		logger.Method(r.Method),
		logger.Path(r.URL.Path),
		logger.RequestID(middleware.GetReqID(r.Context())),
		logger.Duration(time.Since(start)),
	}

	level := slog.LevelInfo
	message := "request succeeded"
	if err != nil {
		level = slog.LevelWarn
		message = "request failed"
		logAttrs = append(logAttrs, logger.Error(err))
		if status >= http.StatusInternalServerError {
			level = slog.LevelError
		}
	}

	slog.LogAttrs(r.Context(), level, message, logAttrs...)
}
