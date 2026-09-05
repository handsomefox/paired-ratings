package handlers

import (
	"net/http"

	"github.com/handsomefox/paired-ratings/backend/gen/pb"
)

func (h *Handler) postRefreshTMDBAll(w http.ResponseWriter, r *http.Request) error {
	ctx := r.Context()

	items, err := h.store.ListTMDBMissing(ctx)
	if err != nil {
		return internal(err)
	}

	for _, item := range items {
		detail, err := h.tmdb.RefreshDetails(ctx, item.TMDBID, item.MediaType)
		if err != nil {
			return &Error{Status: http.StatusBadGateway, Message: err.Error()}
		}

		show := showFromDetail(detail, item.Status)
		if _, err := h.store.UpsertShow(ctx, &show); err != nil {
			return internal(err)
		}
	}

	writeJSON(w, http.StatusOK, &pb.RefreshResponse{Updated: clampInt32(len(items))})
	return nil
}
