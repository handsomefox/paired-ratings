package handlers

import (
	"net/http"

	"github.com/handsomefox/website-rating/internal/gen/pb"
)

func (h *Handler) MiddlewareRequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !h.isAuthenticated(r) {
			writeJSON(w, http.StatusUnauthorized, &pb.ErrorResponse{Error: "unauthorized"})
			return
		}
		next.ServeHTTP(w, r)
	})
}
