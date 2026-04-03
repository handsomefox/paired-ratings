# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A couples movie/TV rating web app. Users share a single password-protected account and can each leave separate ratings and comments on shows sourced from TMDB. Built as a single Go binary that embeds the compiled React frontend.

## Commands

```bash
# Development (builds frontend, then runs backend)
make dev

# Hot reload during development (run both in separate terminals)
make watch-backend    # Go server with air (DISABLE_STATIC=true, port 8080)
make watch-frontend   # Vite dev server (port 5173, proxies /api to :8080)

# Build production binary
make build            # → bin/server

# Format
make fmt              # gofumpt (Go) + prettier (frontend)

# Lint
make lint             # golangci-lint + eslint --fix

# Regenerate proto types (run after editing proto/paired_ratings.proto)
make proto
```

Frontend-only commands (from `frontend/`):
```bash
bun run lint:fix
bun run format
```

Go tests:
```bash
go test ./backend/store/...        # Run store tests (uses in-memory SQLite)
go test ./backend/...              # Run all backend tests
```

## Architecture

**Single binary deployment**: Vite builds to `backend/web/dist/`, which is embedded into the Go binary via `//go:embed`. The backend serves the SPA and falls back to `index.html` for unknown paths.

**Proto as source of truth**: `proto/paired_ratings.proto` defines all API types. `make proto` generates both `backend/gen/pb/paired_ratings.pb.go` and `frontend/src/gen/paired_ratings.ts`. Always run `make proto` after changing the proto file.

**Backend structure**:
- `backend/main.go` — config loading (envconfig + godotenv), router setup, server start
- `backend/handlers/` — HTTP handlers; all handlers return `error` and are wrapped by `Adapt()` in `adapt.go` which handles error → HTTP response conversion
- `backend/store/` — SQLite via Bun ORM; `schema.go` creates tables and runs additive migrations on startup
- `backend/tmdb/` — TMDB API v3 client

**Frontend structure**:
- TanStack Router for routing (`src/App.tsx` defines the route tree)
- TanStack Query for data fetching/caching; all API calls go through `src/lib/api.ts`
- Proto-generated types from `src/gen/paired_ratings.ts` are used directly in the API layer

**Auth**: Cookie-based. Login hashes the shared `APP_PASSWORD` and sets an `HttpOnly` cookie (90-day). `MiddlewareRequireAuth` in `backend/handlers/auth.go` guards all `/api/*` routes except login/session.

**Database**: Single SQLite file (WAL mode, 1 connection). The `shows` table stores TMDB metadata alongside both users' ratings (`bf_rating`, `gf_rating`, `bf_comment`, `gf_comment`, `bf_watch_priority`, `gf_watch_priority`). `UpsertShow` preserves existing ratings when refreshing TMDB metadata.

## Environment Variables

```env
APP_PASSWORD=         # Required: shared login password
TMDB_API_KEY=         # Required: TMDB v3 API key (or use TMDB_API_READ_TOKEN)
DB_PATH=              # Default: /app/data/website-rating.db
PORT=                 # Default: 8080
BF_NAME=              # Display name, default: Boyfriend
GF_NAME=              # Display name, default: Girlfriend
ENV=local             # Set to "local" for dev (relaxed CORS, debug logging)
```

Create a `.env` file at the repo root for local development.
