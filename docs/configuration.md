# Configuration reference

The server loads `.env` from its working directory through `godotenv`. Existing
environment variables take precedence over values in `.env`.
[`backend/main.go`](../backend/main.go) defines the server configuration.

## Required variables

The configuration loader requires these variables:

| Variable       | Purpose                                                                         |
| -------------- | ------------------------------------------------------------------------------- |
| `APP_PASSWORD` | Shared login password.                                                          |
| `TMDB_API_KEY` | TMDB API credential. The client also accepts a JWT read token in this variable. |

## Optional variables

These variables control storage, metadata, and server behavior:

| Variable              | Default                           | Purpose                                                                                                                                      |
| --------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `TMDB_API_READ_TOKEN` | Unset                             | Bearer token for TMDB requests. `TMDB_API_KEY` is still required by the configuration loader.                                                |
| `DB_PATH`             | `/app/data/website-rating.db`     | SQLite database path. `make dev` and `make watch-backend` use `./data/website-rating.db` unless the shell already sets a nonempty `DB_PATH`. |
| `PORT`                | `8080`                            | HTTP server port.                                                                                                                            |
| `TMDB_IMAGE_BASE`     | `https://image.tmdb.org/t/p/w342` | Base URL for TMDB images.                                                                                                                    |
| `BF_NAME`             | `Boyfriend`                       | Display name for the first person's ratings and comments.                                                                                    |
| `GF_NAME`             | `Girlfriend`                      | Display name for the second person's ratings and comments.                                                                                   |
| `DISABLE_STATIC`      | `false`                           | Disables frontend file serving. The Go build still requires files in `backend/web/dist`.                                                     |
| `ENV`                 | `local`                           | Runtime environment. Recognized values are `local` and `production`. Unrecognized values use `local`.                                        |

## Environment behavior

[`backend/env/env.go`](../backend/env/env.go) reads `ENV` during package
initialization. A process environment value selects the mode before startup.

In `local` mode, the server logs at debug level and allows CORS requests from
`http://localhost:<PORT>` and `http://localhost:5173`.
Authentication cookies use `SameSite=Lax` without the `Secure` flag.

In `production` mode, the server logs at info level. Authentication cookies use
`SameSite=None` with the `Secure` flag, so browser login requires HTTPS.

Both modes allow the CORS origin
`https://paired-ratings-production.up.railway.app`.
The allowed origins are defined in `backend/main.go`.

## Persistent storage

The app stores its shared library in a SQLite file. A deployment needs persistent
storage at `DB_PATH` to retain the library across restarts and replacements.
