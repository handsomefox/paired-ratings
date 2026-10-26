// Package handlers wires HTTP routing and API handlers.
package handlers

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/handsomefox/paired-ratings/backend/logger"
	"github.com/handsomefox/paired-ratings/backend/store"
	"github.com/handsomefox/paired-ratings/backend/tmdb"
)

const (
	// requestTimeout bounds an ordinary API request.
	requestTimeout = 10 * time.Second
	// longRequestTimeout bounds the library-wide refresh and the database
	// download, which outgrow requestTimeout as the library grows.
	longRequestTimeout = 2 * time.Minute
	// maxBodyBytes bounds a request body. The largest is a reorder of every
	// show id, far below this.
	maxBodyBytes = 64 << 10
)

type Handler struct {
	store        *store.Store
	tmdb         tmdb.Interface
	csrf         *http.CrossOriginProtection
	logins       loginLimiter
	password     string
	sessionToken string
	imageBase    string
	bfName       string
	gfName       string

	// refreshInterval is how long TMDB metadata counts as current. A negative
	// value makes every show stale, which tests use.
	refreshInterval time.Duration
}

type Config struct {
	Store      *store.Store
	TMDB       tmdb.Interface
	Password   string
	SessionKey []byte
	ImageBase  string
	BfName     string
	GfName     string

	// TrustedOrigins may send state-changing requests besides the server's own
	// origin.
	TrustedOrigins []string
}

func New(cfg *Config) (*Handler, error) {
	switch {
	case cfg.Store == nil:
		return nil, errors.New("store is required")
	case cfg.TMDB == nil:
		return nil, errors.New("tmdb client is required")
	case strings.TrimSpace(cfg.Password) == "":
		return nil, errors.New("password is required")
	case len(cfg.SessionKey) == 0:
		return nil, errors.New("session key is required")
	case strings.TrimSpace(cfg.BfName) == "" || strings.TrimSpace(cfg.GfName) == "":
		return nil, errors.New("both display names are required")
	}

	// Cross-origin protection rejects state-changing requests from other
	// sites, which is what keeps the cookie session safe from CSRF.
	csrf := http.NewCrossOriginProtection()
	for _, origin := range cfg.TrustedOrigins {
		if err := csrf.AddTrustedOrigin(origin); err != nil {
			return nil, err
		}
	}
	csrf.SetDenyHandler(Adapt(func(http.ResponseWriter, *http.Request) error {
		return &Error{Status: http.StatusForbidden, Message: "cross-origin request rejected"}
	}))

	return &Handler{
		store:           cfg.Store,
		tmdb:            cfg.TMDB,
		csrf:            csrf,
		password:        cfg.Password,
		sessionToken:    sessionToken(cfg.SessionKey, cfg.Password),
		imageBase:       cfg.ImageBase,
		bfName:          strings.TrimSpace(cfg.BfName),
		gfName:          strings.TrimSpace(cfg.GfName),
		refreshInterval: defaultRefreshInterval,
	}, nil
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Use(logRequests, limitBody, h.csrf.Handler)
	r.NotFound(Adapt(func(http.ResponseWriter, *http.Request) error { return notFound() }).ServeHTTP)
	r.MethodNotAllowed(Adapt(func(http.ResponseWriter, *http.Request) error {
		return &Error{Status: http.StatusMethodNotAllowed, Message: "method not allowed"}
	}).ServeHTTP)

	r.Group(func(r chi.Router) {
		r.Use(withTimeout(requestTimeout))

		r.Method(http.MethodGet, "/session", Adapt(h.getSession))
		r.Method(http.MethodPost, "/login", Adapt(h.postLogin))
		r.Method(http.MethodPost, "/logout", Adapt(h.postLogout))

		r.Group(func(r chi.Router) {
			r.Use(h.requireAuth)

			r.Method(http.MethodGet, "/search", Adapt(h.getSearch))
			r.Method(http.MethodGet, "/search/genres", Adapt(h.getSearchGenres))
			r.Method(http.MethodGet, "/search/countries", Adapt(h.getSearchCountries))
			r.Method(http.MethodGet, "/search/languages", Adapt(h.getSearchLanguages))
			r.Method(http.MethodGet, "/search/resolve", Adapt(h.getSearchResolve))

			r.Route("/shows", func(r chi.Router) {
				r.Method(http.MethodGet, "/", Adapt(h.getShows))
				r.Method(http.MethodPost, "/", Adapt(h.postShows))
				r.Method(http.MethodPost, "/reorder", Adapt(h.postShowsReorder))

				r.Route("/{id:[0-9]+}", func(r chi.Router) {
					r.Method(http.MethodGet, "/", Adapt(h.getShow))
					r.Method(http.MethodDelete, "/", Adapt(h.deleteShow))

					r.Method(http.MethodGet, "/related", Adapt(h.getShowRelated))
					r.Method(http.MethodGet, "/episodes", Adapt(h.getShowEpisodes))
					r.Method(http.MethodPost, "/episodes/sync", Adapt(h.postShowEpisodesSync))
					r.Method(http.MethodPost, "/episodes/season/{season:[0-9]+}/toggle", Adapt(h.postSeasonToggle))
					r.Method(http.MethodPost, "/ratings", Adapt(h.postShowRatings))
					r.Method(http.MethodPost, "/set-status", Adapt(h.postShowSetStatus))
					r.Method(http.MethodPost, "/clear-ratings", Adapt(h.postShowClearRatings))
					r.Method(http.MethodPost, "/refresh-tmdb", Adapt(h.postShowRefreshTMDB))
					r.Method(http.MethodPost, "/watch-order", Adapt(h.postShowAddToWatchOrder))
					r.Method(http.MethodDelete, "/watch-order", Adapt(h.deleteShowFromWatchOrder))
				})

				r.Method(http.MethodPost, "/episodes/{id:[0-9]+}/toggle", Adapt(h.postEpisodeToggle))
			})

			r.Method(http.MethodPost, "/export", Adapt(h.postExport))
		})
	})

	r.Group(func(r chi.Router) {
		r.Use(h.requireAuth, withTimeout(longRequestTimeout), extendWriteDeadline)

		r.Method(http.MethodGet, "/export/db", Adapt(h.getExportDB))
		r.Method(http.MethodPost, "/refresh-tmdb", Adapt(h.postRefreshTMDBAll))
	})
}

// withTimeout gives the request context a deadline. A handler that runs past
// it returns the context error, which writeError turns into a 504.
func withTimeout(d time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx, cancel := context.WithTimeout(r.Context(), d)
			defer cancel()
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// limitBody caps the request body at maxBodyBytes.
func limitBody(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)
		next.ServeHTTP(w, r)
	})
}

// extendWriteDeadline lifts the server's WriteTimeout to longRequestTimeout.
func extendWriteDeadline(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		err := http.NewResponseController(w).SetWriteDeadline(time.Now().Add(longRequestTimeout))
		if err != nil && !errors.Is(err, http.ErrNotSupported) {
			slog.Warn("extend write deadline failed", logger.Error(err))
		}
		next.ServeHTTP(w, r)
	})
}
