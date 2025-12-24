package main

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/httplog/v3"
	"github.com/handsomefox/website-rating/internal/env"
	"github.com/handsomefox/website-rating/internal/handlers"
	"github.com/handsomefox/website-rating/internal/logger"
	"github.com/handsomefox/website-rating/internal/store"
	"github.com/handsomefox/website-rating/internal/tmdb"
	"github.com/handsomefox/website-rating/internal/web"

	_ "github.com/joho/godotenv/autoload"
)

const (
	defaultPort      = "8080"
	defaultImageBase = "https://image.tmdb.org/t/p/w342"
)

type appConfig struct {
	port                 string
	dbPath               string
	tmdbAPIKey           string
	password             string
	imageBase            string
	bfName               string
	gfName               string
	allowedOrigins       []string
	disableStaticContent bool
}

func loadConfig() (appConfig, error) {
	dbPath := envOr("DB_PATH", "/app/data/website-rating.db")
	apiKey := os.Getenv("TMDB_API_KEY")
	password := os.Getenv("APP_PASSWORD")

	if apiKey == "" {
		return appConfig{}, errors.New("TMDB_API_KEY is required")
	}
	if password == "" {
		return appConfig{}, errors.New("APP_PASSWORD is required")
	}

	port := envOr("PORT", defaultPort)

	disableStaticContent, err := strconv.ParseBool(envOr("DISABLE_STATIC", "false"))
	if err != nil {
		return appConfig{}, err
	}

	origins := []string{
		"https://paired-ratings-production.up.railway.app",
	}
	if env.Current == env.Local {
		origins = append(origins,
			"http://localhost:"+port,
			"http://localhost:5173",
		)
	}

	return appConfig{
		port:                 port,
		dbPath:               dbPath,
		tmdbAPIKey:           apiKey,
		password:             password,
		imageBase:            envOr("TMDB_IMAGE_BASE", defaultImageBase),
		bfName:               envOr("BF_NAME", "Boyfriend"),
		gfName:               envOr("GF_NAME", "Girlfriend"),
		allowedOrigins:       origins,
		disableStaticContent: disableStaticContent,
	}, nil
}

func main() {
	slog.SetDefault(logger.New(slog.LevelDebug))
	if err := run(); err != nil {
		fmt.Println("Error:", err.Error())
		os.Exit(1)
	}
}

func run() error {
	cfg, err := loadConfig()
	if err != nil {
		return err
	}

	st, err := store.Open(cfg.dbPath)
	if err != nil {
		return fmt.Errorf("failed to open db: %w", err)
	}
	defer func() {
		if err := st.Close(); err != nil {
			slog.Error("Failed to close DB", logger.Error(err))
		}
	}()

	app, err := handlers.New(&handlers.Config{
		Store:     st,
		TMDB:      tmdb.New(cfg.tmdbAPIKey, os.Getenv("TMDB_API_READ_TOKEN")),
		Password:  cfg.password,
		ImageBase: cfg.imageBase,
		BfName:    cfg.bfName,
		GfName:    cfg.gfName,
	})
	if err != nil {
		return fmt.Errorf("failed to init handlers: %w", err)
	}

	r := chi.NewRouter()
	r.Use(
		httplog.RequestLogger(slog.Default(), &httplog.Options{
			Level:         slog.LevelWarn,
			RecoverPanics: true,
			Schema:        httplog.SchemaECS.Concise(true),
			Skip: func(req *http.Request, respStatus int) bool {
				if req.URL.Path == "/ping" {
					return true
				}
				return false
			},
		}),
		middleware.Heartbeat("/ping"),
		middleware.RealIP,
		middleware.RequestID,
		cors.Handler(cors.Options{
			AllowedOrigins:   cfg.allowedOrigins,
			AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
			AllowedHeaders:   []string{"Accept", "Content-Type"},
			AllowCredentials: true,
			MaxAge:           600,
		}),
	)

	r.Route("/api", func(api chi.Router) {
		app.RegisterRoutes(api)
	})

	if !cfg.disableStaticContent {
		slog.Info("Serving static content")
		distFS, err := web.Dist()
		if err != nil {
			return fmt.Errorf("failed to load embedded web dist: %w", err)
		}
		spa, err := handlers.SPA(distFS)
		if err != nil {
			return err
		}
		r.Handle("/*", spa)
	}

	addr := ":" + cfg.port
	slog.Info("Listening", slog.String("addr", addr))
	server := &http.Server{
		Addr:              addr,
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return fmt.Errorf("server error: %w", err)
	}
	return nil
}

func envOr(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
