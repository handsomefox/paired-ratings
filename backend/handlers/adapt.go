package handlers

import (
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5/middleware"
	"github.com/handsomefox/website-rating/backend/gen/pb"
	"github.com/handsomefox/website-rating/backend/logger"
)

type HandlerWithErr func(w http.ResponseWriter, r *http.Request) error

type Error struct {
	Status  int
	Message string
}

func (e Error) Error() string {
	return e.Message + " code=" + strconv.FormatInt(int64(e.Status), 10)
}

func Adapt(h HandlerWithErr) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		if err := h(w, r); err != nil {
			status := http.StatusInternalServerError
			message := err.Error()
			var statusErr *Error
			if errors.As(err, &statusErr) {
				status = statusErr.Status
				message = statusErr.Message
			}

			logAttrs := []slog.Attr{
				logger.Error(err),
				logger.Status(status),
				logger.Method(r.Method),
				logger.Path(r.URL.Path),
				logger.RequestID(middleware.GetReqID(r.Context())),
				logger.Duration(time.Since(start)),
			}

			level := slog.LevelWarn
			if status >= http.StatusInternalServerError {
				level = slog.LevelError
			}
			slog.Default().LogAttrs(r.Context(), level, "request failed", logAttrs...)

			writeJSON(w, status, &pb.ErrorResponse{Error: message})
		} else {
			logAttrs := []slog.Attr{
				logger.Status(http.StatusOK),
				logger.Method(r.Method),
				logger.Path(r.URL.Path),
				logger.RequestID(middleware.GetReqID(r.Context())),
				logger.Duration(time.Since(start)),
			}
			slog.Default().LogAttrs(r.Context(), slog.LevelInfo, "request succeeded", logAttrs...)
		}
	})
}
