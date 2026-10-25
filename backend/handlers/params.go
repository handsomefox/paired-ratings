package handlers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"github.com/handsomefox/paired-ratings/backend/store"
)

// idParam reads a positive integer path parameter. The routes only match
// digits, so a failure means the number is out of range.
func idParam(r *http.Request, name string) (int64, error) {
	id, err := strconv.ParseInt(chi.URLParam(r, name), 10, 64)
	if err != nil || id <= 0 {
		return 0, notFound()
	}
	return id, nil
}

// storeError maps store.ErrNotFound to a 404 and keeps every other error.
func storeError(err error) error {
	if errors.Is(err, store.ErrNotFound) {
		return notFound()
	}
	return err
}
