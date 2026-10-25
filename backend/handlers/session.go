package handlers

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/handsomefox/paired-ratings/backend/env"
)

const (
	authCookieName = "auth"
	authCookieAge  = 90 * 24 * time.Hour
	sessionKeySize = 32
)

// LoadSessionKey reads the key that signs the session cookie, and creates it
// on first use. It lives in a file rather than in the database, so a database
// backup cannot be used to forge a session. Deleting the file signs everyone
// out.
func LoadSessionKey(path string) ([]byte, error) {
	key, err := os.ReadFile(path) //nolint:gosec // The operator chooses the path.
	if err == nil {
		if len(key) != sessionKeySize {
			return nil, fmt.Errorf("session key %s has %d bytes, want %d", path, len(key), sessionKeySize)
		}
		return key, nil
	}
	if !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}

	key = make([]byte, sessionKeySize)
	if _, err := rand.Read(key); err != nil {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		return nil, err
	}
	f, err := os.OpenFile(path, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600) //nolint:gosec // The operator chooses the path.
	if err != nil {
		return nil, err
	}
	if _, err := f.Write(key); err != nil {
		return nil, errors.Join(err, f.Close())
	}
	return key, f.Close()
}

// sessionToken is the cookie value for the shared password. It changes when
// the password or the key changes, and it reveals neither.
func sessionToken(key []byte, password string) string {
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte("paired-ratings session\x00" + password))
	return hex.EncodeToString(mac.Sum(nil))
}

// passwordMatches compares in constant time. Hashing first hides the length.
func passwordMatches(got, want string) bool {
	a, b := sha256.Sum256([]byte(got)), sha256.Sum256([]byte(want))
	return subtle.ConstantTimeCompare(a[:], b[:]) == 1
}

func (h *Handler) isAuthenticated(r *http.Request) bool {
	c, err := r.Cookie(authCookieName)
	if err != nil {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(c.Value), []byte(h.sessionToken)) == 1
}

// setAuthCookie stores the session. The app and its API share one origin, so
// SameSite=Lax holds in every mode; production adds Secure, which needs HTTPS.
func setAuthCookie(w http.ResponseWriter, value string, maxAge time.Duration) {
	//nolint:gosec // G124: Secure comes from the environment; gosec only reads literals.
	http.SetCookie(w, &http.Cookie{
		Name:     authCookieName,
		Value:    value,
		Path:     "/",
		MaxAge:   int(maxAge.Seconds()),
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   env.IsProduction(),
	})
}

func clearAuthCookie(w http.ResponseWriter) {
	// A negative MaxAge deletes the cookie.
	setAuthCookie(w, "", -time.Second)
}
