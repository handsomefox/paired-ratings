# Run and maintain the app

The [README](../README.md) covers the first run and the checks. This page covers
the reload loop, the generated code, and deployment.

## Reload after code changes

`make dev` rebuilds and restarts everything, which gets slow. To iterate, run the
backend under Air and the frontend under Vite in two terminals instead.

Install Air and put `air` on `PATH`. Build the frontend once, because
`backend/web/web.go` embeds `backend/web/dist` and the Go build fails while that
directory is empty:

```sh
npm --prefix frontend ci
npm --prefix frontend run build
```

Start the backend with static serving off, so Vite serves the pages:

```sh
make watch-backend
```

In another terminal, start Vite:

```sh
make watch-frontend
```

Open the URL Vite prints, normally <http://localhost:5173>. Vite proxies `/api`
to `http://localhost:8080`. If you change `PORT`, change the proxy target in
`frontend/vite.config.ts` to match.

## Regenerate the generated code

Run `make generate` after you change `proto/paired_ratings.proto`, a migration,
or a query in `backend/store/queries`:

```sh
make generate
```

`make proto` runs buf, which writes the API types to `backend/gen/pb` and
`frontend/src/gen`. `make sqlc` runs sqlc, which writes the database code to
`backend/gen/db`. buf, protoc-gen-go, and sqlc run at the versions pinned under
`tools/`. protoc-gen-ts_proto comes from the frontend dependencies, which
`make proto` installs if they are missing. Commit the generated trees together
with the change that caused them.

## Deploy

`make build` writes one binary to `bin/server` with the frontend assets embedded,
so the host needs nothing else.

1. Copy `bin/server` to the host.
2. Set `APP_PASSWORD` and `TMDB_READ_ACCESS_TOKEN` in the process environment.
3. Mount persistent storage at `/app/data`, or point `DB_PATH` at a file on
   another persistent mount. Without one, every restart starts an empty library.
4. Terminate HTTPS at your host or reverse proxy. Production mode marks the
   authentication cookie `Secure`, so sign-in fails over plain HTTP.
5. Start it with production mode set in the environment:

   ```sh
   ENV=production ./bin/server
   ```

The server refuses to start on a database in the schema from before the
`001_schema` baseline. To convert such a database to a new file, check out
commit `8799861` and run `go run ./backend/cmd/convert-legacy` there.

### Build on a host that builds from source

`go.mod` sits at the repository root, so Railpack, the builder Railway uses,
reads the repository as a Go project and installs no Node. `make build` then
stops at `npm ci` with `npm: not found`. The root [`mise.toml`](../mise.toml)
fixes that by naming both toolchains, and Railpack installs what it lists.

Keep `mise.toml` in step with `go.mod` and `frontend/.nvmrc`. CI compares the
three and fails when they disagree.
