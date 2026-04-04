package handlers

import (
	"log/slog"
	"net/http"

	"github.com/handsomefox/paired-ratings/backend/gen/pb"
)

func (h *Handler) getSession(w http.ResponseWriter, r *http.Request) error {
	authed := h.isAuthenticated(r)

	resp := &pb.SessionResponse{Authenticated: new(authed)}
	if authed {
		resp.ImageBase = new(h.imageBase)
		resp.BfName = new(h.bfName)
		resp.GfName = new(h.gfName)
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
		Authenticated: new(true),
		ImageBase:     new(h.imageBase),
		BfName:        new(h.bfName),
		GfName:        new(h.gfName),
	})
	return nil
}

func (h *Handler) postLogout(w http.ResponseWriter, r *http.Request) error {
	clearAuthCookie(w, r)
	writeJSON(w, http.StatusOK, &pb.SessionResponse{Authenticated: new(false)})
	return nil
}
