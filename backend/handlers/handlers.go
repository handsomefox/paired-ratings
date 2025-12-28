// Package handlers wires HTTP routing and API handlers.
package handlers

import (
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/handsomefox/paired-ratings/backend/store"
	"github.com/handsomefox/paired-ratings/backend/tmdb"
)

type Handler struct {
	store     *store.Store
	tmdb      tmdb.Interface
	password  string
	passHash  string
	imageBase string
	bfName    string
	gfName    string
	genres    genreCache
	countries countryCache
	languages languageCache
}

type Config struct {
	Store     *store.Store
	TMDB      tmdb.Interface
	Password  string
	ImageBase string
	BfName    string
	GfName    string
}

func New(cfg *Config) (*Handler, error) {
	if cfg.Store == nil {
		return nil, errors.New("store is required")
	}
	if cfg.TMDB == nil {
		return nil, errors.New("tmdb client is required")
	}
	if strings.TrimSpace(cfg.Password) == "" {
		return nil, errors.New("password is required")
	}

	bfName := strings.TrimSpace(cfg.BfName)
	if bfName == "" {
		bfName = "Boyfriend"
	}
	gfName := strings.TrimSpace(cfg.GfName)
	if gfName == "" {
		gfName = "Girlfriend"
	}

	return &Handler{
		store:     cfg.Store,
		tmdb:      cfg.TMDB,
		password:  cfg.Password,
		passHash:  hashPassword(cfg.Password),
		imageBase: cfg.ImageBase,
		bfName:    bfName,
		gfName:    gfName,
	}, nil
}

func (h *Handler) RegisterRoutes(r chi.Router) {
	r.Method(http.MethodGet, "/session", Adapt(h.getSession))
	r.Method(http.MethodPost, "/login", Adapt(h.postLogin))

	r.Group(func(r chi.Router) {
		r.Use(h.MiddlewareRequireAuth)

		r.Method(http.MethodPost, "/logout", Adapt(h.postLogout))
		r.Method(http.MethodGet, "/search", Adapt(h.getSearch, WithCompression))
		r.Method(http.MethodGet, "/search/genres", Adapt(h.getSearchGenres, WithCompression))
		r.Method(http.MethodGet, "/search/countries", Adapt(h.getSearchCountries, WithCompression))
		r.Method(http.MethodGet, "/search/languages", Adapt(h.getSearchLanguages, WithCompression))
		r.Method(http.MethodGet, "/search/resolve", Adapt(h.getSearchResolve))
		r.Method(http.MethodGet, "/genres", Adapt(h.getGenres, WithCompression))

		r.Route("/shows", func(r chi.Router) {
			r.Method(http.MethodGet, "/", Adapt(h.getShows, WithCompression))
			r.Method(http.MethodPost, "/", Adapt(h.postShows))

			r.Route("/{id:[0-9]+}", func(r chi.Router) {
				r.Method(http.MethodGet, "/", Adapt(h.getShow))
				r.Method(http.MethodDelete, "/", Adapt(h.deleteShow))

				r.Method(http.MethodPost, "/ratings", Adapt(h.postShowRatings))
				r.Method(http.MethodPost, "/toggle-status", Adapt(h.postShowToggleStatus))
				r.Method(http.MethodPost, "/clear-ratings", Adapt(h.postShowClearRatings))
				r.Method(http.MethodPost, "/refresh-tmdb", Adapt(h.postShowRefreshTMDB))
			})
		})

		r.Method(http.MethodPost, "/export", Adapt(h.postExport, WithCompression))
		r.Method(http.MethodPost, "/refresh-tmdb", Adapt(h.postRefreshTMDBAll))
	})
}
