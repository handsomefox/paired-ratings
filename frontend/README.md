# Frontend

React, TypeScript, Tailwind CSS, and Vite. [`.nvmrc`](.nvmrc) pins the Node
version and `package.json` pins npm under `engines`. For setup and the reload
loop, see [Run and maintain the app](../docs/development.md).

`npm run build` type-checks, bundles, and then compresses the text assets with
gzip and Zstandard through Node's built-in support. It writes to
`backend/web/dist`, which [`backend/web/web.go`](../backend/web/web.go) embeds
into the server binary. `npm run preview` serves the same directory for a local
look at the production build.

`npm test` runs Vitest in jsdom. A test file sits next to the module it covers
and adds `.test` before the extension. Shared setup and render helpers live in
[`src/test`](src/test).

`npm run dev` proxies `/api` to `http://localhost:8080`. The target is set in
[`vite.config.ts`](vite.config.ts).

The API types in [`src/gen`](src/gen) are generated from
[`proto/paired_ratings.proto`](../proto/paired_ratings.proto). Regenerate them
with `make proto` from the repository root, which updates the Go types in the
same pass. Do not edit them by hand.

[`src/lib/api.ts`](src/lib/api.ts) decodes every response with the generated
`fromJSON`. The backend leaves zero values such as `false` and `[]` out of its
JSON, and `fromJSON` puts them back, so the types hold. Query keys and cache
updates live in [`src/lib/queries.ts`](src/lib/queries.ts).

When a new build is deployed, the service worker waits, and a toast offers to
reload. It never reloads on its own, so an unsaved rating survives a deploy.

## eslint-plugin-jsx-a11y needs an override

`eslint-plugin-jsx-a11y` declares support only up to ESLint 9. The `overrides`
entry in `package.json` lets npm install it next to ESLint 10. It runs without
errors on ESLint 10, but check it again when you update ESLint.

## Two TypeScript packages are installed

`tsc` is TypeScript 7, the native compiler, and it type-checks the build.
TypeScript 7 ships no JavaScript API. So `typescript` in `package.json` is an
alias for `@typescript/typescript6`, which still provides one, and
`typescript-eslint` loads it from there. That package also
installs the old compiler as `tsc6`. Bump both aliases together.
