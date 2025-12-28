# Paired Ratings Web

The frontend lives in `frontend/` and is built with Vite + React + TypeScript + Tailwind. Production builds are output to `backend/web/dist` and embedded into the Go binary.

## Scripts

```bash
bun install
bun run dev
```

For a full-stack dev loop:

```bash
ENV=local make dev
```

The Vite dev server proxies `/api` to `http://localhost:8080`.

## Protobuf Types

API shapes come from `proto/paired_ratings.proto`. Regenerate types with:

```bash
make proto
```

The generated types live in `frontend/src/gen`.
