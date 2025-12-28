package handlers

import (
	"log/slog"
	"net/http"

	"github.com/handsomefox/website-rating/backend/gen/pb"
)

func (h *Handler) getSession(w http.ResponseWriter, r *http.Request) error {
	authed := h.isAuthenticated(r)

	resp := &pb.SessionResponse{Authenticated: ptr(authed)}
	if authed {
		resp.ImageBase = ptr(h.imageBase)
		resp.BfName = ptr(h.bfName)
		resp.GfName = ptr(h.gfName)
	}

	writeJSON(w, http.StatusOK, resp)
	return nil
}

func (h *Handler) postLogin(w http.ResponseWriter, r *http.Request) error {
	var req pb.LoginRequest
	if err := decodeJSON(r, &req); err != nil {
		return badRequest("bad request")
	}

	if req.Password != h.password {
		slog.Warn("login: invalid password", slog.String("remote", r.RemoteAddr))
		return unauthorized("invalid password")
	}

	setAuthCookie(w, r, h.passHash)
	writeJSON(w, http.StatusOK, &pb.SessionResponse{
		Authenticated: ptr(true),
		ImageBase:     ptr(h.imageBase),
		BfName:        ptr(h.bfName),
		GfName:        ptr(h.gfName),
	})
	return nil
}

func (h *Handler) postLogout(w http.ResponseWriter, r *http.Request) error {
	clearAuthCookie(w, r)
	writeJSON(w, http.StatusOK, &pb.SessionResponse{Authenticated: ptr(false)})
	return nil
}
