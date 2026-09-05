# Repository guidelines

The [README](README.md) covers running the app and the checks. This page covers
the conventions that are easy to break without a failing test.

## The proto file owns the API types

`proto/paired_ratings.proto` defines every request and response. `make proto`
regenerates the Go types into `backend/gen/pb` and the TypeScript types into
`frontend/src/gen`. Both trees are committed. Never hand-edit either one: the
next `make proto` overwrites it, and the two sides drift silently because
nothing compares them.

Change the `.proto` first, regenerate, then fix both sides in the same commit.

## Handlers return errors, they do not write them

A handler has the shape `func(w, r) error` and is wrapped with `Adapt`, which
logs the request and writes the JSON error body. Return `badRequest`,
`unauthorized`, or `notFound` from `backend/handlers/errors.go` to pick a status.
Return a bare error for anything that should be a 500. Do not call `http.Error`
or write a status code by hand, because that bypasses the log line and the
`ErrorResponse` shape the frontend parses.

## Schema changes are migrations

`backend/store/store.go` embeds `backend/store/migrations/*.sql` and runs them
through goose at startup. Add a new numbered file. Never edit a migration that
has already run against a real database, because goose records it as applied and
will not run it again.

## Build the frontend before the Go build

`backend/web/web.go` embeds `backend/web/dist`. A fresh checkout has no such
directory, so `go build` and `go test` fail until `npm --prefix frontend run
build` has run once. This is the usual reason a first build fails.

## Environment mode is read once, at init

`backend/env/env.go` reads `ENV` during package initialization, before anything
in `main` runs, so it cannot be changed per request or in a test after startup.
It decides the log level, the allowed CORS origins, and the authentication
cookie flags: `local` uses `SameSite=Lax` without `Secure`, and `production` uses
`SameSite=None` with `Secure`, which means sign-in fails over plain HTTP.

Keep the allowed origins in `backend/main.go`. Do not read `ENV` anywhere else.

## Authentication is one shared password

There is one password for both people, hashed into a cookie. `BF_NAME` and
`GF_NAME` are display labels on the two rating columns, not accounts. Do not add
per-user state keyed on them.

## Before you commit

Run `make fmt`, `make lint`, and `make test` once after a coherent set of edits.
`make lint` runs the Go linter first and stops before the frontend if it fails,
so read the whole output.

The Go commands are scoped to `./backend/...`. Keep them that way, because
`./...` reaches into `frontend/node_modules` and lints third-party Go code.

Write commit subjects in the imperative on one line. In a pull request, say what
changed and paste the commands you ran.
