# Frontend

React, TypeScript, Tailwind CSS, and Vite. [`.nvmrc`](.nvmrc) selects Node.js 24,
and `package.json` requires npm 11. For setup and the reload loop, see
[Run and maintain the app](../docs/development.md).

`npm run build` type-checks, bundles, and then compresses the text assets with
gzip and Zstandard through Node's built-in support. It writes to
`backend/web/dist`, which [`backend/web/web.go`](../backend/web/web.go) embeds
into the server binary. Nothing serves this directory directly.

`npm run dev` proxies `/api` to `http://localhost:8080`. The target is set in
[`vite.config.ts`](vite.config.ts).

The API types in [`src/gen`](src/gen) are generated from
[`proto/paired_ratings.proto`](../proto/paired_ratings.proto). Regenerate them
with `make proto` from the repository root, which updates the Go types in the
same pass. Do not edit them by hand.
