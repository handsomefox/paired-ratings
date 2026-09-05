# Run and maintain the app

The [README](../README.md) covers the first run and the checks. This page covers
the reload loop, the generated API types, and deployment.

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

## Regenerate the API types

`proto/paired_ratings.proto` defines the request and response types for both
sides. `make proto` writes the Go types to `backend/gen/pb` and the TypeScript
types to `frontend/src/gen`. Both trees are committed, so commit them together
with the `.proto` change.

It needs `protoc` and `protoc-gen-go` on `PATH`, and the frontend dependencies,
which supply `protoc-gen-ts_proto`:

```sh
npm --prefix frontend ci
make proto
```

## Deploy

`make build` writes one binary to `bin/server` with the frontend assets embedded,
so the host needs nothing else.

1. Copy `bin/server` to the host.
2. Set `APP_PASSWORD` and `TMDB_API_KEY` in the process environment.
3. Mount persistent storage at `/app/data`, or point `DB_PATH` at a file on
   another persistent mount. Without one, every restart starts an empty library.
4. Terminate HTTPS at your host or reverse proxy. Production mode marks the
   authentication cookie `Secure`, so sign-in fails over plain HTTP.
5. Start it with production mode set in the environment:

   ```sh
   ENV=production ./bin/server
   ```
