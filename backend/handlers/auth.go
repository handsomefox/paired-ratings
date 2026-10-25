package handlers

import (
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/handsomefox/paired-ratings/backend/gen/pb"
)

const (
	loginFailureLimit  = 10
	loginFailureWindow = time.Minute
)

// loginLimiter counts failed logins across all clients. Behind Railway's proxy
// every request shares an address, and the app has one password, so a global
// count is the meaningful one. The window is short, so the real users wait at
// most a minute.
type loginLimiter struct {
	failures []time.Time
	mu       sync.Mutex
}

func (l *loginLimiter) blocked(now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.dropExpired(now)
	return len(l.failures) >= loginFailureLimit
}

func (l *loginLimiter) fail(now time.Time) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.dropExpired(now)
	l.failures = append(l.failures, now)
}

func (l *loginLimiter) dropExpired(now time.Time) {
	i := 0
	for i < len(l.failures) && now.Sub(l.failures[i]) >= loginFailureWindow {
		i++
	}
	l.failures = l.failures[i:]
}

func (h *Handler) requireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !h.isAuthenticated(r) {
			writeError(w, unauthorized("unauthorized"))
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (h *Handler) getSession(w http.ResponseWriter, r *http.Request) error {
	if !h.isAuthenticated(r) {
		writeJSON(w, http.StatusOK, &pb.SessionResponse{Authenticated: new(false)})
		return nil
	}
	writeJSON(w, http.StatusOK, h.signedInSession())
	return nil
}

func (h *Handler) postLogin(w http.ResponseWriter, r *http.Request) error {
	var req pb.LoginRequest
	if err := decodeJSON(r, &req); err != nil {
		return badRequest("bad request")
	}

	now := time.Now()
	if h.logins.blocked(now) {
		return tooManyRequests("too many failed sign-in attempts, try again in a minute")
	}
	if !passwordMatches(req.Password, h.password) {
		h.logins.fail(now)
		slog.Warn("login: invalid password", slog.String("remote", r.RemoteAddr))
		return unauthorized("invalid password")
	}

	setAuthCookie(w, h.sessionToken, authCookieAge)
	writeJSON(w, http.StatusOK, h.signedInSession())
	return nil
}

func (h *Handler) postLogout(w http.ResponseWriter, _ *http.Request) error {
	clearAuthCookie(w)
	writeJSON(w, http.StatusOK, &pb.SessionResponse{Authenticated: new(false)})
	return nil
}

func (h *Handler) signedInSession() *pb.SessionResponse {
	return &pb.SessionResponse{
		Authenticated: new(true),
		ImageBase:     new(h.imageBase),
		BfName:        new(h.bfName),
		GfName:        new(h.gfName),
	}
}
