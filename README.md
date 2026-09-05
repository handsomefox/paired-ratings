# Paired Ratings

A shared movie and TV library for two people behind one password. Every title
carries two ratings and two comments, labeled with `BF_NAME` and `GF_NAME`, so
you can disagree about a film without overwriting each other. TMDB supplies
search, posters, and metadata. The library lives in a SQLite file.

- Search TMDB, or discover titles by type, year, rating, and vote count.
- Save a title as planned or watched, rate it 1 to 10, and leave a comment.
- Filter by status, genre, year range, and missing ratings. Sort by rating,
  year, or title.
- Refresh a title's TMDB metadata, or delete the entry.
- Export the library as JSON.

## Run it locally

You need Go 1.27.1 or newer, Node.js 24, npm 11, Make, and a TMDB API key.

Write `.env` in the repository root:

```dotenv
APP_PASSWORD=replace_with_your_shared_password
TMDB_API_KEY=replace_with_your_tmdb_key
```

Then start everything with one command:

```sh
make dev
```

That installs the frontend dependencies, builds the frontend, and serves the app
on <http://localhost:8080>. Sign in with `APP_PASSWORD`.

`make dev` rebuilds the frontend on every run and nothing watches for changes, so
an edit needs Ctrl+C and another `make dev`. For a reload loop instead, see
[Run and maintain the app](docs/development.md).

Every other setting has a default, including `DB_PATH`, `PORT`, and the two
display names. [Configuration](docs/configuration.md) lists all of them.

## Check a change

```sh
make fmt
make lint
make test
```

`make fmt` needs `gofumpt`, and `make lint` needs `golangci-lint`. Both run over
the Go code and then the frontend. Run the frontend build once before the Go
commands, because `backend/web/web.go` embeds `backend/web/dist` and the Go build
fails while that directory is empty.

## Further reading

- [Run and maintain the app](docs/development.md): the reload loop, regenerating
  the API types, and deploying.
- [Configuration](docs/configuration.md): every environment variable.
- [Frontend](frontend/README.md): where the build output goes and how the dev
  server reaches the API.
- [Repository guidelines](AGENTS.md): the conventions to follow when changing
  the code.
