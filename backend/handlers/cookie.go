package handlers

import (
	"crypto/subtle"
	"net/http"
	"time"

	"github.com/handsomefox/paired-ratings/backend/env"
)

const (
	authCookieName = "auth"
	authCookieDays = 90
)

func (h *Handler) isAuthenticated(r *http.Request) bool {
	c, err := r.Cookie(authCookieName)
	if err != nil {
		return false
	}
	if c.Value == "" || h.passHash == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(c.Value), []byte(h.passHash)) == 1
}

func setAuthCookie(w http.ResponseWriter, r *http.Request, value string) {
	expiration := time.Now().Add(time.Hour * 24 * authCookieDays)
	http.SetCookie(w, &http.Cookie{
		Name:     authCookieName,
		Value:    value,
		Path:     "/",
		Expires:  expiration,
		MaxAge:   int((time.Hour * 24 * authCookieDays).Seconds()),
		HttpOnly: true,
		SameSite: sameSite(),
		Secure:   secure(),
	})
}

func clearAuthCookie(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     authCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		SameSite: sameSite(),
		Secure:   secure(),
	})
}

func sameSite() http.SameSite {
	if env.IsProduction() {
		return http.SameSiteNoneMode
	}
	return http.SameSiteLaxMode
}

func secure() bool {
	return env.IsProduction()
}
