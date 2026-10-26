package handlers

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"runtime/debug"
	"time"

	"github.com/go-chi/chi/v5/middleware"

	"github.com/handsomefox/paired-ratings/backend/gen/pb"
	"github.com/handsomefox/paired-ratings/backend/logger"
)

type HandlerWithErr func(w http.ResponseWriter, r *http.Request) error

// Adapt turns a handler that returns an error into an http.Handler. A returned
// error becomes the JSON error body, and the request log line records it.
func Adapt(h HandlerWithErr) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := h(w, r); err != nil {
			writeError(w, err)
		}
	})
}

// writeError writes err as a pb.ErrorResponse. If the response has already
// started, it only records err for the log line.
func writeError(w http.ResponseWriter, err error) {
	if rec, ok := w.(*responseRecorder); ok {
		rec.err = err
		if rec.wroteHeader {
			return
		}
	}

	status, message := http.StatusInternalServerError, "internal server error"
	if e, ok := errors.AsType[*Error](err); ok {
		status, message = e.Status, e.Message
	}
	// A request deadline can surface through any error, including a wrapped
	// TMDB failure, so it wins over the status the error carries.
	if errors.Is(err, context.DeadlineExceeded) {
		status, message = http.StatusGatewayTimeout, "request timed out"
	}
	writeJSON(w, status, &pb.ErrorResponse{Error: message})
}

// responseRecorder remembers the status and error of a response for the log.
type responseRecorder struct {
	http.ResponseWriter
	err         error
	status      int
	wroteHeader bool
}

// WriteHeader keeps the first status. net/http ignores a later one anyway.
func (r *responseRecorder) WriteHeader(status int) {
	if r.wroteHeader {
		return
	}
	r.status, r.wroteHeader = status, true
	r.ResponseWriter.WriteHeader(status)
}

func (r *responseRecorder) Write(b []byte) (int, error) {
	if !r.wroteHeader {
		r.WriteHeader(http.StatusOK)
	}
	return r.ResponseWriter.Write(b)
}

// Unwrap lets http.ResponseController reach the underlying writer.
func (r *responseRecorder) Unwrap() http.ResponseWriter { return r.ResponseWriter }

// logRequests writes one log line per request with the status that was sent.
// It also turns a panic into a 500, so the client still gets an ErrorResponse.
func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rec := &responseRecorder{ResponseWriter: w, status: http.StatusOK}
		serveRecovered(next, rec, r)

		attrs := []slog.Attr{
			logger.Status(rec.status),
			logger.Method(r.Method),
			logger.Path(r.URL.Path),
			logger.RequestID(middleware.GetReqID(r.Context())),
			logger.Duration(time.Since(start)),
		}
		level, message := slog.LevelInfo, "request succeeded"
		if rec.err != nil || rec.status >= http.StatusBadRequest {
			level, message = slog.LevelWarn, "request failed"
			if rec.status >= http.StatusInternalServerError {
				level = slog.LevelError
			}
		}
		if rec.err != nil {
			attrs = append(attrs, logger.Error(rec.err))
		}
		slog.LogAttrs(r.Context(), level, message, attrs...)
	})
}

func serveRecovered(next http.Handler, w http.ResponseWriter, r *http.Request) {
	defer func() {
		v := recover()
		if v == nil {
			return
		}
		if v == http.ErrAbortHandler { //nolint:errorlint // net/http compares the sentinel the same way.
			panic(v)
		}
		writeError(w, fmt.Errorf("panic: %v\n%s", v, debug.Stack()))
	}()
	next.ServeHTTP(w, r)
}
