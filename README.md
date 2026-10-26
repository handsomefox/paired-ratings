# Paired Ratings

A shared movie and TV library for two people behind one password. Every title
carries two ratings and two comments, labeled with `BF_NAME` and `GF_NAME`, so
you can disagree about a film without overwriting each other. TMDB supplies
search, posters, and metadata. The library lives in a SQLite file.

- Search TMDB, or discover titles by type, genre, year, rating, vote count,
  country, and language.
- Save a title as planned, watching, or watched. Each person rates it 1 to 10
  and leaves a comment.
- Track watched episodes of a TV show, one at a time or a season at once.
- Keep a shared watch order and reorder it by dragging.
- See the rest of a movie's collection, or TMDB's recommendations, on its page.
- Filter the library by status, genre, country, year range, and missing
  ratings. Sort by either rating, the average, year, title, or recent changes.
- Refresh TMDB metadata for one title or the whole library.
- Export the library as JSON, or download the whole database.

## Run it locally

You need Go, Node.js, npm, Make, and a TMDB API Read Access Token. `go.mod`
pins the Go version, `frontend/.nvmrc` pins Node, and `frontend/package.json`
sets the minimum npm under `engines`. Run `nvm use` in `frontend` to pick up the
pinned Node.

Write `.env` in the repository root:

```dotenv
APP_PASSWORD=replace_with_your_shared_password
TMDB_READ_ACCESS_TOKEN=replace_with_your_tmdb_read_access_token
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

The Go tools run through `go tool` at the versions pinned in `tools/go.mod`, so
there is nothing to install. Each target runs over the Go code and then the
frontend, so `make test` covers the Go tests and the Vitest suite. To report
formatting without rewriting files, run `make fmt-check`. That is the check CI
runs.

Run the frontend build once before the Go commands, because
`backend/web/web.go` embeds `backend/web/dist` and the Go build fails while that
directory is empty.

[The CI workflow](.github/workflows/ci.yml) runs the same checks on every push
and pull request.

## Further reading

- [Run and maintain the app](docs/development.md): the reload loop, regenerating
  the API types, and deploying.
- [Configuration](docs/configuration.md): every environment variable.
- [Frontend](frontend/README.md): where the build output goes and how the dev
  server reaches the API.
- [Repository guidelines](AGENTS.md): the conventions to follow when changing
  the code.
