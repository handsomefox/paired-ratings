# Frontend

React, TypeScript, Tailwind CSS, and Vite. [`.nvmrc`](.nvmrc) pins the Node
version and `package.json` pins npm under `engines`. For setup and the reload
loop, see [Run and maintain the app](../docs/development.md).

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

## Two TypeScript packages are installed

`tsc` is TypeScript 7, the native compiler, and it type-checks the build.
TypeScript 7 ships no JavaScript API. So `typescript` in `package.json` is an
alias for `@typescript/typescript6`, which still provides one, and
`typescript-eslint` and `ts-proto` load it from there. That package also
installs the old compiler as `tsc6`. Bump both aliases together.
