package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/kelseyhightower/envconfig"

	"github.com/handsomefox/paired-ratings/backend/env"
	"github.com/handsomefox/paired-ratings/backend/handlers"
	"github.com/handsomefox/paired-ratings/backend/logger"
	"github.com/handsomefox/paired-ratings/backend/store"
	"github.com/handsomefox/paired-ratings/backend/tmdb"
	"github.com/handsomefox/paired-ratings/backend/web"

	_ "github.com/joho/godotenv/autoload"
)

// shutdownTimeout is how long in-flight requests get to finish after SIGTERM.
const shutdownTimeout = 15 * time.Second

type appConfig struct {
	Port                 string `envconfig:"PORT" default:"8080"`
	DBPath               string `envconfig:"DB_PATH" default:"/app/data/website-rating.db"`
	SessionKeyPath       string `envconfig:"SESSION_KEY_PATH"`
	TMDBReadAccessToken  string `envconfig:"TMDB_READ_ACCESS_TOKEN" required:"true"`
	Password             string `envconfig:"APP_PASSWORD" required:"true"`
	ImageBase            string `envconfig:"TMDB_IMAGE_BASE" default:"https://image.tmdb.org/t/p/w342"`
	BFName               string `envconfig:"BF_NAME" default:"Boyfriend"`
	GFName               string `envconfig:"GF_NAME" default:"Girlfriend"`
	DisableStaticContent bool   `envconfig:"DISABLE_STATIC" default:"false"`
}

// trustedOrigins may send state-changing requests besides the server's own
// origin. Production serves the app and the API from one origin. Locally, the
// Vite dev server proxies /api; browsers that send Sec-Fetch-Site pass anyway,
// and this entry covers the ones that send only Origin.
func trustedOrigins() []string {
	if !env.IsLocal() {
		return nil
	}
	return []string{"http://localhost:5173"}
}

func main() {
	logLevel := slog.LevelInfo
	if env.IsLocal() {
		logLevel = slog.LevelDebug
	}
	slog.SetDefault(logger.New(logLevel))

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	err := run(ctx)
	stop()
	if err != nil {
		slog.Error("server stopped", logger.Error(err))
		os.Exit(1)
	}
}

// newRouter mounts the API under /api and, unless disabled, the app at /.
func newRouter(app *handlers.Handler, cfg *appConfig) (http.Handler, error) {
	r := chi.NewRouter()
	r.Use(
		middleware.Recoverer,
		middleware.Heartbeat("/ping"),
		middleware.RequestID,
		middleware.CleanPath,
	)
	r.Route("/api", app.RegisterRoutes)

	if !cfg.DisableStaticContent {
		distFS, err := web.Dist()
		if err != nil {
			return nil, fmt.Errorf("static content: %w", err)
		}
		spa, err := handlers.SPA(distFS)
		if err != nil {
			return nil, err
		}
		r.Handle("/*", spa)
		slog.Info("Serving static content")
	}
	return r, nil
}

func run(ctx context.Context) error {
	if err := env.Check(); err != nil {
		return err
	}
	var cfg appConfig
	if err := envconfig.Process("", &cfg); err != nil {
		return err
	}
	if cfg.SessionKeyPath == "" {
		cfg.SessionKeyPath = filepath.Join(filepath.Dir(cfg.DBPath), "session.key")
	}

	st, err := store.Open(ctx, cfg.DBPath)
	if err != nil {
		return fmt.Errorf("open db: %w", err)
	}
	defer func() {
		if err := st.Close(); err != nil {
			slog.Error("close db failed", logger.Error(err))
		}
	}()

	sessionKey, err := handlers.LoadSessionKey(cfg.SessionKeyPath)
	if err != nil {
		return fmt.Errorf("load session key: %w", err)
	}

	app, err := handlers.New(&handlers.Config{
		Store:      st,
		TMDB:       tmdb.NewCachedClient(tmdb.New(cfg.TMDBReadAccessToken)),
		Password:   cfg.Password,
		SessionKey: sessionKey,
		ImageBase:  cfg.ImageBase,
		BfName:     cfg.BFName,
		GfName:     cfg.GFName,

		TrustedOrigins: trustedOrigins(),
	})
	if err != nil {
		return fmt.Errorf("init handlers: %w", err)
	}

	router, err := newRouter(app, &cfg)
	if err != nil {
		return err
	}

	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	serveErr := make(chan error, 1)
	go func() {
		slog.Info("Listening", slog.String("addr", server.Addr))
		serveErr <- server.ListenAndServe()
	}()

	select {
	case err := <-serveErr:
		return err
	case <-ctx.Done():
	}

	slog.Info("Shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), shutdownTimeout)
	defer cancel()
	if err := server.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("shutdown: %w", err)
	}
	if err := <-serveErr; !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}
