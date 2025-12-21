package handlers

import (
	"crypto/subtle"
	"net/http"

	"github.com/handsomefox/website-rating/internal/env"
)

const authCookieName = "auth"

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
	http.SetCookie(w, &http.Cookie{
		Name:     authCookieName,
		Value:    value,
		Path:     "/",
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
	switch env.Current {
	case env.Production:
		return http.SameSiteNoneMode
	default:
		return http.SameSiteLaxMode
	}
}

func secure() bool {
	switch env.Current {
	case env.Production:
		return true
	default:
		return false
	}
}
