# Repository guidelines

The [README](README.md) covers running the app and the checks. This page covers
the conventions that are easy to break without a failing test.

## Generated code has one source each

Two trees of generated code are committed. Never hand-edit either one, because
`make generate` overwrites them and CI fails when they differ from their
sources.

- `proto/paired_ratings.proto` defines every request and response. buf writes
  the Go types into `backend/gen/pb` and the TypeScript types into
  `frontend/src/gen`, as configured in `buf.gen.yaml`.
- `backend/store/migrations` and `backend/store/queries` define the database.
  sqlc writes the Go query code into `backend/gen/db`, as configured in
  `sqlc.yaml`.

Change the source first, run `make generate`, then fix the Go and TypeScript
code in the same commit.

The backend encodes responses with `encoding/json`, which leaves out zero
values such as `false`, `0`, and empty lists. The frontend parses every
response with the generated `fromJSON`, which puts the zero values back. Do not
read a response body without it.

## Handlers return errors, they do not write them

A handler has the shape `func(w, r) error` and is wrapped with `Adapt`, which
writes the JSON error body. `logRequests` writes one log line per request,
including the error. Return a constructor from `backend/handlers/errors.go`,
such as `badRequest` or `badGateway`, to pick a status. Return a bare error for
anything that should be a 500. The client then gets "internal server error",
and the details stay in the log.

Middleware that rejects a request calls `writeError`. Do not call `http.Error`
or write an error status by hand, because that skips the log line and the
`ErrorResponse` shape the frontend parses.

## Schema changes are new migrations

`backend/store/store.go` embeds `backend/store/migrations/*.sql` and runs them
through goose at startup. Add a new numbered file. Never edit or delete a
migration that has run against a real database: goose records it as applied and
does not run it again. CI fails any change that modifies or deletes an existing
migration.

The schema enforces what it can: `STRICT` tables, `CHECK` constraints on status,
media type and ratings, and foreign keys. `store.Open` turns on foreign keys for
every connection, so deleting a show deletes its genres, countries and
episodes.

## Frontend state goes through the router and the query keys

Pages keep their filters in the URL through the router: read them with
`Route.useSearch()` and change them with `navigate({ search })`. Do not read or
write `window.location` directly, because the router then shows stale search
params. Build query keys with `queryKeys` in `frontend/src/lib/queries.ts`, and
update the cache after a change with the helpers there, so every page that
shows a title sees the change.

## Build the frontend before the Go build

`backend/web/web.go` embeds `backend/web/dist`. A fresh checkout has no such
directory, so `go build` and `go test` fail until `npm --prefix frontend run
build` has run once. This is the usual reason a first build fails.

## Environment mode is read once, at init

`backend/env/env.go` reads `ENV` during package initialization, before anything
in `main` runs, so it cannot change per request or in a test after startup. An
unset `ENV` means `local`. Any value other than `local` or `production` stops
the server at startup.

The mode decides the log level, the trusted origins, and the `Secure` flag on
the session cookie. In `production`, the cookie is `Secure`, so sign-in fails
over plain HTTP. The cookie is `SameSite=Lax` in both modes, because the app and
the API share one origin.

`handlers.RegisterRoutes` puts `http.CrossOriginProtection` in front of every
API route, so a state-changing request from another site gets a 403. Keep the
trusted origins in `backend/main.go`, which passes them in through
`handlers.Config`. Do not read `ENV` anywhere else.

## Authentication is one shared password

There is one password for both people. The session cookie is an HMAC of that
password, keyed by a random key in the file at `SESSION_KEY_PATH`. Changing the
password or deleting the key file signs everyone out. `BF_NAME` and `GF_NAME`
are display labels on the two rating columns, not accounts. Do not add per-user
state keyed on them.

## Before you commit

Run `make fmt`, `make lint`, and `make test` once after a coherent set of edits.
Each target runs the Go side first and stops before the frontend if it fails, so
read the whole output. `make test` covers the Go tests and the Vitest suite.

The Go tools run at the versions pinned in `tools/go.mod` and
`tools/buf/go.mod`, through `go tool`. The Makefile and CI both use them, so do
not install your own.

The Go commands are scoped to `./backend/...`. Keep them that way, because
`./...` reaches into `frontend/node_modules` and lints third-party Go code.

Write commit subjects in the imperative on one line. In a pull request, say what
changed and paste the commands you ran.
