package main

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/httplog/v3"
	"github.com/kelseyhightower/envconfig"

	"github.com/handsomefox/website-rating/backend/env"
	"github.com/handsomefox/website-rating/backend/handlers"
	"github.com/handsomefox/website-rating/backend/logger"
	"github.com/handsomefox/website-rating/backend/store"
	"github.com/handsomefox/website-rating/backend/tmdb"
	"github.com/handsomefox/website-rating/backend/web"

	_ "github.com/joho/godotenv/autoload"
)

type appConfig struct {
	Port                 string `envconfig:"PORT" default:"8080"`
	DBPath               string `envconfig:"DB_PATH" default:"/app/data/website-rating.db"`
	TMDBAPIKey           string `envconfig:"TMDB_API_KEY" required:"true"`
	TMDBReadToken        string `envconfig:"TMDB_API_READ_TOKEN"`
	Password             string `envconfig:"APP_PASSWORD" required:"true"`
	ImageBase            string `envconfig:"TMDB_IMAGE_BASE" default:"https://image.tmdb.org/t/p/w342"`
	BFName               string `envconfig:"BF_NAME" default:"Boyfriend"`
	GFName               string `envconfig:"GF_NAME" default:"Girlfriend"`
	DisableStaticContent bool   `envconfig:"DISABLE_STATIC" default:"false"`
	AllowedOrigins       []string
}

func loadConfig() (appConfig, error) {
	var cfg appConfig
	if err := envconfig.Process("", &cfg); err != nil {
		return appConfig{}, err
	}

	origins := []string{
		"https://paired-ratings-production.up.railway.app",
	}
	if env.IsLocal() {
		origins = append(origins,
			"http://localhost:"+cfg.Port,
			"http://localhost:5173",
		)
	}
	cfg.AllowedOrigins = origins

	return cfg, nil
}

func main() {
	logLevel := slog.LevelInfo
	if env.IsLocal() {
		logLevel = slog.LevelDebug
	}
	slog.SetDefault(logger.New(logLevel))

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

	st, err := store.Open(cfg.DBPath)
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
		TMDB:      tmdb.New(cfg.TMDBAPIKey, cfg.TMDBReadToken),
		Password:  cfg.Password,
		ImageBase: cfg.ImageBase,
		BfName:    cfg.BFName,
		GfName:    cfg.GFName,
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
				return req.URL.Path == "/ping"
			},
		}),
		middleware.Heartbeat("/ping"),
		middleware.RealIP,
		middleware.RequestID,
		cors.Handler(cors.Options{
			AllowedOrigins:   cfg.AllowedOrigins,
			AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
			AllowedHeaders:   []string{"Accept", "Content-Type"},
			AllowCredentials: true,
			MaxAge:           600,
		}),
	)

	r.Route("/api", func(api chi.Router) {
		app.RegisterRoutes(api)
	})

	if !cfg.DisableStaticContent {
		distFS, err := web.Dist()
		if err != nil {
			slog.Warn("Static dist not available, skipping", logger.Error(err))
		} else {
			slog.Info("Serving static content")
			spa, err := handlers.SPA(distFS)
			if err != nil {
				return err
			}
			r.Handle("/*", spa)
		}
	}

	addr := ":" + cfg.Port
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
