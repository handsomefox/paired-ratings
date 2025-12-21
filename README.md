# Website Rating

A tiny, password‑gated web app for tracking movies and TV shows. Pull titles from TMDB, mark them planned or watched, and keep two sets of ratings/comments (BF/GF) in one shared library.

## Features

- TMDB search + discover (filters by type, year, rating, vote count; sort options).
- Add shows as planned or watched; watched entries can be rated 1–10 with comments.
- Library filters: status, genre, year range, unrated only; sort by ratings/year/title.
- Detail page with poster, metadata, TMDB score/votes, ratings, comments, and delete.
- Export library as JSON and refresh TMDB metadata.
- Simple single‑password login gate.

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
ENV=local
```

## Common Commands

- `make dev`: build the frontend and run the server locally.
- `make web-dev`: run the Vite dev server.
- `make web-build`: build the frontend (outputs `internal/web/dist`).
- `make fmt`: format Go code with `gofumpt`.
- `make lint`: run `golangci-lint`.
- `make proto`: generate Go + TS types from `proto/paired_ratings.proto`.

## Deployment Notes

The app is designed for a single shared login and a persistent SQLite file:

```
DB_PATH=/app/data/website-rating.db
```
