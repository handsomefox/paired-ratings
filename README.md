# Website Rating

A tiny, password‑gated web app for tracking movies and TV shows. Pull titles from TMDB, mark them planned or watched, and keep two sets of ratings/comments (BF/GF) in one shared library.

## Features
- TMDB search + discover (filters by type, year, rating, vote count; sort options).
- Add shows as planned or watched; watched entries can be rated 1–10 with comments.
- Library filters: status, genre, year range, unrated only; sort by ratings/year/title.
- Detail page with poster, metadata, TMDB score/votes, ratings, comments, and delete.
- Export library as JSON and refresh TMDB metadata.
- Simple single‑password login gate.

## Tech Stack
- Go + `net/http`
- SQLite (auto‑created schema)
- Server‑rendered HTML + small JS for live filters/infinite scroll

## Project Structure
- `cmd/server/`: server entrypoint
- `internal/handlers/`: HTTP handlers, auth, view helpers
- `internal/store/`: SQLite access + schema
- `internal/tmdb/`: TMDB client
- `web/templates/`: HTML templates
- `web/static/`: CSS/JS assets

## Local Development
Requirements: Go 1.22+ (or your system default), `gofumpt`, `golangci-lint`.

```bash
make dev
```

By default `make dev` uses `DB_PATH=./data/website-rating.db`. The database file is created automatically.

## Configuration (.env)
`.env` is loaded automatically via `godotenv`. Required variables:

```
APP_PASSWORD=your_shared_password
TMDB_API_KEY=your_tmdb_key
```

Optional:

```
TMDB_API_READ_TOKEN=optional_read_token
DB_PATH=/path/to/website-rating.db
PORT=8080
TMDB_IMAGE_BASE=https://image.tmdb.org/t/p/w342
BF_NAME=Boyfriend
GF_NAME=Girlfriend
```

## Common Commands
- `make dev`: run the server locally.
- `make fmt`: format Go code with `gofumpt`.
- `make lint`: run `golangci-lint`.

## Deployment Notes
The app is designed for a single shared login and a persistent SQLite file. For Railway or similar hosts, mount a volume and set:

```
DB_PATH=/app/data/website-rating.db
```

## Usage Flow
1. Log in with `APP_PASSWORD`.
2. Use **Add** to search TMDB and add items as planned/watched.
3. Open a show to rate (1–10) and leave comments.
4. Filter/sort the library; export when needed.
