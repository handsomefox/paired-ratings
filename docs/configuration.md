# Configuration reference

The server loads `.env` from its working directory through `godotenv`. Existing
environment variables take precedence over values in `.env`.
[`backend/main.go`](../backend/main.go) defines the server configuration.

## Required variables

The configuration loader requires these variables:

| Variable                 | Purpose                                                                                              |
| ------------------------ | ---------------------------------------------------------------------------------------------------- |
| `APP_PASSWORD`           | Shared login password.                                                                               |
| `TMDB_READ_ACCESS_TOKEN` | The API Read Access Token from TMDB's API settings, not the shorter API Key. Sent as a Bearer token. |

## Optional variables

These variables control storage, metadata, and server behavior:

| Variable           | Default                               | Purpose                                                                                                                   |
| ------------------ | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `DB_PATH`          | `/app/data/website-rating.db`         | SQLite database path. `make dev` and `make watch-backend` use `./data/paired-ratings.db` unless the shell sets `DB_PATH`. |
| `SESSION_KEY_PATH` | `session.key` in the `DB_PATH` folder | File that holds the key for the session cookie. The server creates it on first start. Deleting it signs everyone out.     |
| `PORT`             | `8080`                                | HTTP server port.                                                                                                         |
| `TMDB_IMAGE_BASE`  | `https://image.tmdb.org/t/p/w342`     | Base URL for TMDB images.                                                                                                 |
| `BF_NAME`          | `Boyfriend`                           | Display name for the first person's ratings and comments.                                                                 |
| `GF_NAME`          | `Girlfriend`                          | Display name for the second person's ratings and comments.                                                                |
| `DISABLE_STATIC`   | `false`                               | Disables frontend file serving. The Go build still requires files in `backend/web/dist`.                                  |
| `ENV`              | `local`                               | Runtime environment: `local` or `production`. Any other value stops the server at startup.                                |

## Environment behavior

[`backend/env/env.go`](../backend/env/env.go) reads `ENV` during package
initialization. A process environment value selects the mode before startup.

In `local` mode, the server logs at debug level. It also accepts state-changing
requests from `http://localhost:<PORT>` and from the Vite dev server at
`http://localhost:5173`.

In `production` mode, the server logs at info level and accepts state-changing
requests only from its own origin. The session cookie gets the `Secure` flag, so
browser login requires HTTPS.

The session cookie is `SameSite=Lax` in both modes. The trusted origins are
defined in `backend/main.go`.

## Persistent storage

The app stores its shared library in a SQLite file. A deployment needs persistent
storage at `DB_PATH` to retain the library across restarts and replacements.
Keep `SESSION_KEY_PATH` on the same persistent storage, or every restart signs
everyone out.
