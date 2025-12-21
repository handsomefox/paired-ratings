package handlers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/handsomefox/website-rating/internal/gen/pb"
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
		if err := h(w, r); err != nil {
			var statusErr *Error
			if errors.As(err, &statusErr) {
				writeJSON(w, statusErr.Status, &pb.ErrorResponse{Error: statusErr.Message})
				return
			}
			writeJSON(w, http.StatusInternalServerError, &pb.ErrorResponse{Error: err.Error()})
		}
	})
}
