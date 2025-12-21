package main

import (
	"errors"
	"log"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/handsomefox/website-rating/internal/handlers"
	"github.com/handsomefox/website-rating/internal/logger"
	"github.com/handsomefox/website-rating/internal/store"
	"github.com/handsomefox/website-rating/internal/tmdb"

	_ "github.com/joho/godotenv/autoload"
)

const (
	defaultPort      = "8080"
	defaultImageBase = "https://image.tmdb.org/t/p/w342"
)

func main() {
	slog.SetDefault(logger.NewExitOnLevelLogger(slog.LevelError))

	dbPath := envOr("DB_PATH", "/app/data/website-rating.db")
	apiKey := os.Getenv("TMDB_API_KEY")
	password := os.Getenv("APP_PASSWORD")
	bfName := envOr("BF_NAME", "Boyfriend")
	gfName := envOr("GF_NAME", "Girlfriend")
	if apiKey == "" {
		slog.Error("TMDB_API_KEY is required")
	}
	if password == "" {
		slog.Error("APP_PASSWORD is required")
	}

	st, err := store.Open(dbPath)
	if err != nil {
		slog.Error("Failed to open DB", logger.Error(err))
	}
	defer func() {
		if err := st.Close(); err != nil {
			slog.Error("Failed to close DB", logger.Error(err))
		}
	}()

	imageBase := envOr("TMDB_IMAGE_BASE", defaultImageBase)

	app, err := handlers.New(handlers.Config{
		Store:     st,
		TMDB:      tmdb.New(apiKey, os.Getenv("TMDB_API_READ_TOKEN")),
		Password:  password,
		ImageBase: imageBase,
		BfName:    bfName,
		GfName:    gfName,
	})
	if err != nil {
		slog.Error("Failed to init handlers", logger.Error(err))
	}

	mux := http.NewServeMux()
	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("web/static"))))
	app.RegisterRoutes(mux)

	addr := ":" + envOr("PORT", defaultPort)
	log.Printf("listening on %s", addr)
	server := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Printf("server error: %v", err)
	}
}

func envOr(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
