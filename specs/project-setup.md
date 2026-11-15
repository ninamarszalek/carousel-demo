# Spec — Project Setup: Vite + SSR, TypeScript, Tooling

Status: **Implemented** (2026-11-15). Section 17 lists where the implementation differs from the first draft, and why.
Covers requirements: TECH-1, TECH-CSS-1..4, TECH-BUILD-1, TECH-SSR-1, TECH-HAND-1..4, TECH-API-1, DEL-2, EVAL-1, EVAL-3, EVAL-4, EVAL-6, EVAL-7 (see [requirements.md](requirements.md)).

## 1. Goal

Set up a hand-built React + TypeScript project with Vite and our own SSR server. The setup must:

- keep **server code and client code clearly separated** (TECH-HAND-1, EVAL-7),
- be **strictly typed and linted** from the first commit (EVAL-1, EVAL-5),
- enforce **clean, ordered styles** with tooling, not only by convention (EVAL-3),
- have tests ready to write at every level: unit, component and e2e (EVAL-6),
- run with as few commands as possible, so the "how to run" docs stay short and reliable (DEL-2).

Out of scope here; each gets its own spec later: routing and the SSR data-loading strategy, the TMDB integration, the design system and category themes, the wish list state.

## 2. Constraints (from the challenge)

- The project starts empty, or from `npm create vite@latest` with the `react-ts` template, which is then reshaped by hand. No SSR starter templates and no generators (TECH-HAND-3, TECH-HAND-4).
- No Next.js, Remix, or **React Router "framework mode"**. React Router is used **only as a library** (declarative/data mode) (TECH-HAND-2).
- No Styled Components, CSS Modules or Tailwind. Styles are global **SCSS** files with BEM naming (TECH-CSS-3, TECH-CSS-4).
- No UI component libraries (Radix, Shadcn, …), to get the extra points (TECH-LIB-4).

## 3. Runtime and package manager

| Decision            | Choice                                                    | Why                                                                          |
| ------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Node.js             | **24 LTS**, pinned in `.nvmrc` and `package.json#engines` | Current LTS. Built-in `process.loadEnvFile()` means no `dotenv` is needed.   |
| Package manager     | **npm** (lockfile committed)                              | Nothing extra for reviewers to install, so the run instructions stay simple. |
| Module system       | `"type": "module"` (ESM everywhere)                       | Matches Vite and modern Node.                                                |
| Dependency versions | Latest stable at setup time, exact versions via lockfile  | Reproducible installs.                                                       |

Version pins forced by compatibility (re-check them when upgrading):

- **TypeScript `~6.0`**: `typescript-eslint` supports `<6.1`, so TypeScript 7 is not usable yet.
- **ESLint `^9`**: `eslint-plugin-react` and `eslint-plugin-jsx-a11y` do not support ESLint 10 yet.

## 4. Directory structure

```
carousel-demo/
├── index.html                  # HTML template with <!--app-head--> / <!--app-html--> placeholders
├── server/                     # Node-only code (never shipped to the browser)
│   ├── dev.ts                  # Dev entry: Vite in middleware mode + ssrLoadModule
│   ├── prod.ts                 # Prod entry (→ dist/server/index.js): sets NODE_ENV, then loads production.ts
│   ├── production.ts           # Prod wiring: compression, static assets, template + SSR bundle loaded once
│   ├── app.ts                  # createApp(): Express app shared by both modes (helmet, /healthz, /api, SSR, errors)
│   ├── render.ts               # SsrEntry contract + streaming render handler (template split, errors, timeout)
│   ├── lifecycle.ts            # run() (readable startup errors) + listen() (graceful shutdown)
│   ├── config.ts               # Reads and validates env vars (fails fast on missing TMDB token)
│   └── api/router.ts           # Backend-for-frontend: TMDB proxy routes (keeps the API token off the client)
├── src/                        # Isomorphic + client code (bundled by Vite)
│   ├── entry-client.tsx        # hydrateRoot()
│   ├── entry-server.tsx        # render(url, …) → React stream (renderToPipeableStream)
│   ├── app/                    # App shell: App.tsx, routes, providers, error boundary
│   ├── pages/                  # Route-level components: Home, FilmDetails, Wishlist, NotFound
│   ├── features/               # Domain modules (films, wishlist): components + hooks + logic per feature
│   ├── components/             # Shared, domain-agnostic UI (Button, Carousel, Header, Image, …)
│   ├── lib/                    # Framework-agnostic helpers (http client, formatting, …)
│   ├── types/                  # Shared TS types (domain models, API DTOs)
│   └── styles/                 # Global SCSS architecture (see §8)
├── tests/
│   ├── setup/                  # Vitest setup (jest-dom matchers, MSW server)
│   ├── mocks/                  # MSW handlers + fixtures (TMDB responses)
│   └── e2e/                    # Playwright specs
├── public/                     # Static assets copied as-is (favicon, …)
├── specs/                      # Specifications (this folder)
└── <config files>              # see §5–§10
```

Rules:

- **Tests sit next to the code** (`Button.tsx` → `Button.test.tsx`). `tests/` holds only shared setup, mocks and e2e.
- One component per folder when it has its own styles or tests: `components/Button/{Button.tsx, Button.test.tsx, _button.scss, index.ts}`.
- **Import boundaries** are enforced by ESLint (§6):
  - `src/**` must not import from `server/**`.
  - `server/**` may import only `src/types/**`. It loads the SSR entry at runtime, not through an import: in dev with `vite.ssrLoadModule()`, in prod with a dynamic `import()` of `dist/server/entry-server.js`. The `SsrEntry` interface in `server/render.ts` is the contract between the two sides.
  - `components/` must not import from `features/` or `pages/`. `features/` must not import from `pages/`.
- Path alias **`@/` → `src/`**, defined once in `tsconfig.base.json`. Vite reads it from there (`resolve.tsconfigPaths: true`).

## 5. TypeScript configuration

A solution-style setup with project references, so each environment gets the right `lib` and `types`:

| File                 | Includes                                                                                      | Environment                                                                                                                           |
| -------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `tsconfig.json`      | — (only `references`)                                                                         | root                                                                                                                                  |
| `tsconfig.app.json`  | `src/**`                                                                                      | DOM + `vite/client` types                                                                                                             |
| `tsconfig.node.json` | `server/**`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `eslint.config.ts` | Node types, no DOM                                                                                                                    |
| `tsconfig.test.json` | `**/*.test.ts(x)`, `tests/**`                                                                 | DOM + Node + `vite/client`; jest-dom matchers come from `tests/setup/client.ts`. Vitest APIs are imported explicitly, with no globals |

Shared compiler options in `tsconfig.base.json`:

```jsonc
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "moduleDetection": "force",
    "jsx": "react-jsx",
    "noEmit": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "allowImportingTsExtensions": true,
    "erasableSyntaxOnly": true, // no enums/namespaces: code must be strippable by any TS-to-JS tool
    "skipLibCheck": true,
    "resolveJsonModule": true,

    // strictness
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "useUnknownInCatchVariables": true,
    "forceConsistentCasingInFileNames": true,

    "paths": { "@/*": ["./src/*"] },
  },
}
```

- `tsc -b` (the `typecheck` script) checks every project. Vite does not type-check, so CI runs this as a separate step.
- If `exactOptionalPropertyTypes` causes real friction with library types, it is the only flag we may turn off, and the reason must be written down.

## 6. ESLint

**Flat config** in `eslint.config.ts`, with type-aware linting.

| Package                                                            | Purpose                                                                            |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `@eslint/js` (recommended)                                         | baseline                                                                           |
| `typescript-eslint` (`strictTypeChecked` + `stylisticTypeChecked`) | type-aware TS rules                                                                |
| `eslint-plugin-react` (`recommended` + `jsx-runtime`)              | React rules                                                                        |
| `eslint-plugin-react-hooks`                                        | Rules of Hooks, exhaustive deps                                                    |
| `eslint-plugin-jsx-a11y` (`strict`)                                | accessibility (carousels and buttons must be keyboard- and screen-reader-friendly) |
| `eslint-plugin-import-x`                                           | import hygiene, cycles, ordering                                                   |
| `@vitest/eslint-plugin`                                            | test-file rules                                                                    |
| `eslint-plugin-testing-library` + `eslint-plugin-jest-dom`         | RTL best practices                                                                 |
| `eslint-plugin-playwright`                                         | e2e rules (only for `tests/e2e/**`)                                                |
| `eslint-config-prettier`                                           | turns off formatting rules (Prettier owns formatting)                              |

Custom rules on top of the presets:

- `@typescript-eslint/consistent-type-imports`: `error`
- `@typescript-eslint/no-explicit-any`: `error`
- `@typescript-eslint/explicit-module-boundary-types`: `off` (rely on inference; exported API types are explicit by convention)
- `import-x/no-default-export`: `error`, except config files and route-level lazy chunks if needed
- `import-x/no-cycle`: `error`
- `import-x/order`: groups builtin → external → internal (`@/`) → parent/sibling, alphabetized, with a newline between groups
- `import-x/no-restricted-paths`: enforces the boundaries from §4
- `import-x/no-named-as-default-member`: `off` (TypeScript already checks imports; the rule only flags documented usages like `tseslint.configs`)
- `react/function-component-definition`: named components are function declarations
- Testing Library rules apply only to DOM tests, not to `*.ssr.test.ts` (node)
- `no-console`: `error` in `src/**` (allow `warn`/`error`); allowed in `server/**`
- `react/jsx-no-useless-fragment`, `react/self-closing-comp`, `react/no-array-index-key`: `error`
- `eqeqeq`, `curly: all`, `prefer-const`, `object-shorthand`: `error`

Lint must pass with **zero warnings** (`--max-warnings=0`).

## 7. Prettier and EditorConfig

- `.prettierrc`: `singleQuote: true`, `semi: true`, `trailingComma: "all"`, `printWidth: 100`.
- `.prettierignore`: `dist`, `coverage`, `playwright-report`, lockfile.
- `.editorconfig`: UTF-8, LF, 2 spaces, final newline, trim trailing whitespace.

## 8. Styles: SCSS and Stylelint (EVAL-3)

Folder structure (a simplified 7-1 pattern):

```
src/styles/
├── abstracts/      # _tokens.scss (design tokens), _mixins.scss, _breakpoints.scss — emit no CSS
├── base/           # _reset.scss, _typography.scss, _root.scss (CSS custom properties)
├── themes/         # per-category themes: fonts, button variants, colors (FR-CAT-1..3) — added with the themes spec
├── layout/         # page-level layout (app shell; later home stack, detail 2-column + info row)
└── main.scss       # the only global entry; @use order: base → themes → layout
```

- `main.scss` is linked from `index.html` (`<link rel="stylesheet">`), not imported from JS. Vite processes and hashes it in the build, and the SSR HTML is styled before hydration, also in dev (no flash of unstyled content).
- Component styles sit next to their component as partials (`_carousel.scss`) and are imported by the component, so Vite splits CSS per chunk (TECH-CSS-2).
- Use only the modern Sass module system: `@use` / `@forward`, never `@import`. Each partial that needs abstracts `@use`s them explicitly (`@use '../abstracts' as *;`). There is no `additionalData` injection, so every dependency is visible.
- Tokens are Sass maps in `abstracts/_tokens.scss`. `base/_root.scss` turns them into CSS custom properties (`--color-*`, `--space-*`, `--font-size-*`), and components use only the custom properties.
- Naming follows **BEM** (`.film-card__title--highlighted`), enforced by Stylelint.
- Category themes are driven by **CSS custom properties** under a `[data-category="…"]` scope, so components never branch on the category in their styles.

**Stylelint:**

- `stylelint-config-standard-scss`: baseline
- `stylelint-config-clean-order`: **property order** (positioning → box model → typography → visual → misc), with a blank line between groups
- `selector-class-pattern`: a BEM regex
- `max-nesting-depth: 3`, `selector-max-compound-selectors: 3`, `selector-max-id: 0`, `declaration-no-important: true`, `color-named: never`
- `scss/no-global-function-names` (modern Sass: `map.get`, not `map-get`)
- Runs with `--max-warnings=0`, like ESLint
- Colors, spacing and font sizes in components must come from tokens. This is a convention for now, and can later be enforced with `stylelint-declaration-strict-value`.

## 9. Vite and SSR server

### 9.1 Vite config (`vite.config.ts`)

- `@vitejs/plugin-react`
- `resolve.tsconfigPaths: true`: the `@/` alias comes from tsconfig
- SCSS: Vite 8 uses the modern Sass compiler (`sass-embedded`) by default, so no `css.preprocessorOptions` are needed
- One config, two builds (`isSsrBuild`), see §9.3
- `build.manifest` / `ssrManifest`: **not enabled yet**. They are needed only for preloading route-level chunks, so they are added together with code splitting.
- `ssr.noExternal`: not needed so far

### 9.2 Server: Express 5

| Mode     | Behaviour                                                                                                                                                                                                                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **dev**  | `server/dev.ts`. Creates the Vite server in `middlewareMode` (`appType: 'custom'`) and uses `vite.middlewares`. For each request it runs `vite.transformIndexHtml()`, then `vite.ssrLoadModule('/src/entry-server.tsx')`. On error it calls `vite.ssrFixStacktrace()`. The server process restarts on changes in `server/**` (`tsx watch`). |
| **prod** | `server/prod.ts` → `server/production.ts`. Uses `compression`, then `express.static` for `dist/client` (hashed `assets/` get `Cache-Control: max-age=1y, immutable`; `index.html` is never served raw, since it is the template). It loads the template and `dist/server/entry-server.js` once at startup.                                  |

`prod.ts` sets `process.env.NODE_ENV = 'production'` and only then dynamically imports `production.ts`. That way React and Express load their production builds, and `npm start` needs no `NODE_ENV=` prefix or `cross-env`.

Both modes build the same Express app with `createApp({ mode, renderer, middleware })`. Mode-specific behaviour is injected (a `Renderer` and extra middleware), which also lets tests run the real app with a fake renderer.

Shared for both modes:

- **Streaming SSR** with `renderToPipeableStream`. The HTML shell is sent on `onShellReady`, and there is a 10 s timeout with `abort()`. The status code is set from the router (404 for an unknown film/route) once routing lands.
- **Bots get the complete page** (`server/render.ts`). The handler checks the `User-Agent` with [`isbot`](https://github.com/omrilotan/isbot), a maintained list of search engines, link-preview bots and other crawlers:
  - **users**: the response starts at `onShellReady`, so the page appears at once with Suspense fallbacks and the content streams in;
  - **bots**: the response starts at `onAllReady`, with all content inline and no fallbacks. Many bots (Slack, Facebook, LinkedIn, Discord previews) do not run JavaScript, so streamed-in content would stay hidden for them. Googlebot indexes the raw HTML first. `<head>` tags that depend on data (title, `og:image`) can be filled in only at this point.
  - The content is the same, only the timing differs, so this is not cloaking. A faked User-Agent only changes when the HTML is sent, so it is no security concern.
  - `Vary: User-Agent` is set, so caches and CDNs never serve a user's streamed response to a bot, or the other way round.
  - On timeout, `abort()` turns pending boundaries into client-rendered ones and fires `onAllReady`, so a bot gets what was ready, with status 500, instead of a hanging request. The timeout can be configured (`createRenderHandler(renderer, { timeoutMs })`) for tests.
- **Fallback to client rendering**: if the shell fails (`onShellError`), the server sends the template with an empty `#root` and status 500. `entry-client.tsx` then calls `createRoot().render()` instead of `hydrateRoot()`, so the user still gets a working page.
- The sink React pipes into exposes `flush()`, so streamed chunks pass through `compression` right away.
- The server-side data loaded for the request is **serialized into the HTML** safely (escape `<`, so no XSS through JSON) and handed to the client for hydration. _How the data is loaded is defined in the SSR/data spec._
- **`/api/*`** routes proxy TMDB (BFF). The **TMDB key exists only on the server** and has no `VITE_` prefix, so Vite never exposes it to the bundle.
- `/healthz` endpoint.
- Graceful shutdown on `SIGTERM`/`SIGINT`.
- Security headers come from `helmet`, and `x-powered-by` is disabled. In production there is a CSP with `img-src` that allows `image.tmdb.org`. `upgrade-insecure-requests` is removed, because HTTPS is the reverse proxy's job and the directive would break plain-HTTP runs on a LAN IP. In dev the CSP is off, because Vite injects inline scripts for HMR.
- Unknown `/api/*` routes return a JSON 404 and never fall through to SSR.

### 9.3 Builds

```
dist/
├── client/   # vite build        → index.html (template) + hashed assets/
└── server/   # vite build --ssr  → index.js (from server/prod.ts) + entry-server.js (+ shared chunks)
```

The server build has two inputs (`server/prod.ts`, `src/entry-server.tsx`) in a single `vite build --ssr`. It uses the same TS and alias handling, with no extra build tool, and `public/` is not copied into it.

## 10. Environment variables

- `.env.example` is committed and lists every variable with a comment: `TMDB_ACCESS_TOKEN` (the TMDB "API Read Access Token", v4 Bearer auth) and `PORT=3000`. `NODE_ENV` is not a user setting: each entry point sets the mode.
- `.env` is git-ignored. It is loaded in `server/config.ts` with `process.loadEnvFile()` when the file exists.
- `config.ts` validates the variables once at startup, **lists every problem at once** and exits with a clear message (this is good for reviewers running the project).

## 11. Testing setup (EVAL-6)

| Level     | Tool                                                    | What                                                                                                                                                                 |
| --------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit      | **Vitest**                                              | pure logic: mappers, utils, store/reducers                                                                                                                           |
| Component | **Vitest + React Testing Library + jsdom + user-event** | components and pages, with the network mocked by **MSW**                                                                                                             |
| SSR       | **Vitest (node env)**                                   | `render()` from `entry-server` produces the expected HTML and status codes, and serialized data is escaped                                                           |
| Server    | **Vitest + supertest**                                  | Express routes: `/api/*` proxy, 404 handling, `/healthz`                                                                                                             |
| E2E       | **Playwright**                                          | key user flows on the **production build**, including one run with **JavaScript disabled** to prove the SSR output (homepage carousels and detail page are readable) |

- Coverage: `@vitest/coverage-v8`, reported in `text` + `html`. Thresholds of 80% (lines, statements, functions, branches) are enforced since the first features landed. Process entry points and lifecycle glue (`entry-client.tsx`, `server/{dev,prod,production,lifecycle}.ts`) are excluded from unit coverage, because the e2e tests cover them.
- Vitest uses `projects` to run the `client` project (jsdom: `src/**/*.test.tsx`) and the `server` project (node: `server/**/*.test.ts` and `src/**/*.ssr.test.ts`) from one config, `vitest.config.ts`, which extends `vite.config.ts`.
- MSW runs with `onUnhandledFrame: 'error'` (the MSW 3 name), so a test never reaches the real network by accident.
- Playwright starts the built server (`node dist/server/index.js`) on port 4173 with a placeholder token. The e2e homepage test also fails on any console error, which catches hydration mismatches and CSP violations.

## 12. Quality gates

- **Husky + lint-staged**: on pre-commit, run ESLint, Stylelint and Prettier on the staged files.
- _(Optional)_ **commitlint** with Conventional Commits.
- **GitHub Actions CI** (`.github/workflows/ci.yml`) on push to `main` and on PRs, in this order: `npm ci` → `typecheck` → `lint` → `lint:styles` → `format:check` → `test:coverage` → `build` → **check that the token is not in `dist/client`** → `playwright test`. The Playwright report is uploaded when a run fails.

## 13. npm scripts

| Script                                  | Command                                                         |
| --------------------------------------- | --------------------------------------------------------------- |
| `dev`                                   | `tsx watch --tsconfig tsconfig.node.json server/dev.ts`         |
| `build`                                 | `npm run build:client && npm run build:server`                  |
| `build:client` / `build:server`         | `vite build` / `vite build --ssr`                               |
| `start`                                 | `node dist/server/index.js` (production mode, set by the entry) |
| `typecheck`                             | `tsc -b`                                                        |
| `lint` / `lint:fix`                     | `eslint . --max-warnings=0` (`--fix`)                           |
| `lint:styles`                           | `stylelint "src/**/*.scss" --max-warnings=0`                    |
| `format` / `format:check`               | `prettier --write .` / `prettier --check .`                     |
| `test` / `test:watch` / `test:coverage` | `vitest run` / `vitest` / `vitest run --coverage`               |
| `test:e2e`                              | `npm run build && playwright test`                              |
| `check`                                 | everything CI runs, in one command                              |
| `prepare`                               | `husky` (installs the git hooks on `npm install`)               |

## 14. Repository files

- `.gitignore`: extended with `coverage/`, `playwright-report/`, `test-results/`, `*.tsbuildinfo`.
- `.nvmrc`, `.editorconfig`, `.env.example`
- `README.md`: a thorough run guide (DEL-2): prerequisites, getting a TMDB key, `.env` setup, dev/prod/test commands, troubleshooting. It also has short sections on the architecture and the SSR strategy, with links to `specs/`.
- `.vscode/extensions.json` and `.vscode/settings.json`: ESLint, Stylelint and Prettier extensions, format on save. `.gitignore` keeps only these two files from `.vscode/`.

## 15. Open decisions

1. **Dockerfile**: a multi-stage build so the app runs with one command (`docker compose up`). Nice for reviewers, but not required.
2. **commitlint**: adds discipline, but is a small extra.
3. **`exactOptionalPropertyTypes`**: kept, with no friction so far (see §5).

## 16. Acceptance criteria

- [x] `npm ci && npm run dev` serves an SSR-rendered page ("view source" shows the content) and hydrates without warnings in the console.
- [x] `npm run build && npm start` serves the production build with hashed, cached assets.
- [x] `npm run check` passes: typecheck, ESLint (0 warnings), Stylelint, Prettier, tests, build, e2e.
- [x] Importing `server/**` from `src/**` fails lint.
- [x] A missing `TMDB_ACCESS_TOKEN` stops the server at startup with a readable message.
- [x] The TMDB token never appears in `dist/client/**` (checked in CI).
- [x] A Playwright test with JavaScript disabled sees the homepage content.

## 17. Changes from the first draft

| Draft                                    | Implemented                                         | Why                                                                                                   |
| ---------------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| one `server/index.ts` for both modes     | `dev.ts` / `prod.ts` entries + shared `createApp()` | No mode flags at runtime; dev-only `vite` is never loaded in prod; the app can be tested in isolation |
| `NODE_ENV` via flag or default           | `prod.ts` sets it before loading the app            | React must see it before it loads; works on every OS without `cross-env`                              |
| three builds (client, SSR entry, server) | two builds (client, one SSR build with two inputs)  | Simpler; one output folder, shared chunks                                                             |
| `sirv` or `express.static`               | `express.static` + guard for `index.html`           | No extra dependency; the raw template must never be served                                            |
| `resolve.alias` in Vite                  | `resolve.tsconfigPaths`                             | The alias is defined once (DRY)                                                                       |
| `scss.api: 'modern-compiler'`            | nothing                                             | It is the default in Vite 8                                                                           |
| abstracts via `additionalData` or `@use` | explicit `@use` only                                | Dependencies are visible in each file                                                                 |
| global styles imported from JS           | `main.scss` linked in `index.html`                  | No flash of unstyled SSR HTML, also in dev                                                            |
| `manifest` / `ssrManifest` enabled       | not yet                                             | Only useful with route-level code splitting                                                           |
| `no-restricted-imports` for boundaries   | `import-x/no-restricted-paths`                      | Folder-based zones, clearer messages                                                                  |
| `TMDB_API_KEY`                           | `TMDB_ACCESS_TOKEN`                                 | TMDB recommends the v4 Read Access Token (Bearer header)                                              |
| `tsconfig.test.json` optional            | required                                            | Test files need DOM + Node types and are excluded from the app/node projects                          |
