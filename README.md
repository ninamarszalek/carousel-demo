# Film Browser

A web app for browsing films by category, opening film details and building a wish list.
It is built with React and TypeScript, bundled with Vite, and rendered on the server by a hand-written Express SSR server. No framework is used.

> **Status:** all features are done: routing and SSR data loading (TMDB), the arc carousels, the film pages with category themes, and the wish list. See [`specs/`](specs/).

## Contents

- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Running in production mode](#running-in-production-mode)
- [Testing and quality checks](#testing-and-quality-checks)
- [Available scripts](#available-scripts)
- [How pages are rendered](#how-pages-are-rendered)
- [Project structure](#project-structure)
- [Troubleshooting](#troubleshooting)

## Prerequisites

| Tool    | Version                                      | Check with      |
| ------- | -------------------------------------------- | --------------- |
| Node.js | **24 or newer** (the version is in `.nvmrc`) | `node -v`       |
| npm     | 10 or newer (comes with Node.js)             | `npm -v`        |
| Git     | any recent version                           | `git --version` |

If you use [nvm](https://github.com/nvm-sh/nvm), run `nvm use` in the project folder to switch to the right Node.js version.

You also need a **TMDB API Read Access Token**. It is free:

1. Create an account at [themoviedb.org](https://www.themoviedb.org/signup).
2. Open **Settings → API** ([direct link](https://www.themoviedb.org/settings/api)) and request an API key (type: _Developer_).
3. Copy the **API Read Access Token**, the long token that starts with `eyJ…`. Do not use the shorter "API Key".

## Getting started

```bash
# 1. Clone the repository and open the folder
git clone <repository-url> carousel-demo
cd carousel-demo

# 2. Install dependencies (uses the exact versions from package-lock.json)
npm ci

# 3. Create your local environment file and paste your TMDB token into it
cp .env.example .env
#    then edit .env:  TMDB_ACCESS_TOKEN=eyJ...

# 4. Start the development server
npm run dev
```

Open **http://localhost:3000**.

In development mode:

- pages are rendered on the server, and React then hydrates them in the browser,
- client code changes are applied instantly (Hot Module Replacement),
- server changes (`server/**`) restart the server automatically.

To use another port, set `PORT` in `.env`.

## Running in production mode

```bash
npm run build   # builds dist/client (browser assets) and dist/server (Node server + SSR bundle)
npm start       # starts the production server on http://localhost:3000
```

`npm start` reads `.env` too, so the same token works in both modes. You don't need `NODE_ENV=production`: the production entry point sets it itself, and this works on macOS, Linux and Windows.

## Testing and quality checks

```bash
npm test              # unit, component, SSR and server tests (Vitest)
npm run test:coverage # the same, with a coverage report (open coverage/index.html)
npm run test:e2e      # builds the app and runs browser tests (Playwright)
npm run check         # everything CI runs: types, lint, styles, formatting, tests, e2e
```

Before the first `test:e2e` run, install the test browser once:

```bash
npx playwright install chromium
```

E2E tests run against the **production build**. TMDB is replaced by a small local mock (`tests/e2e/tmdb-mock-server.ts`), so they need no token or network and always see the same films. Some of them run with **JavaScript disabled**, which proves that the pages are rendered on the server and that the wish list form works as plain HTML.

A git pre-commit hook (Husky + lint-staged) lints and formats staged files automatically.

## Available scripts

| Script                  | What it does                                        |
| ----------------------- | --------------------------------------------------- |
| `npm run dev`           | Development server with SSR + HMR (`server/dev.ts`) |
| `npm run build`         | Production build: `build:client` + `build:server`   |
| `npm start`             | Runs the production build (`dist/server/index.js`)  |
| `npm run typecheck`     | Type-checks all TypeScript projects (`tsc -b`)      |
| `npm run lint`          | ESLint, type-aware, zero warnings allowed           |
| `npm run lint:fix`      | ESLint with auto-fix                                |
| `npm run lint:styles`   | Stylelint for SCSS (property order, BEM naming)     |
| `npm run format`        | Formats all files with Prettier                     |
| `npm run format:check`  | Checks formatting without changing files            |
| `npm test`              | Runs Vitest once                                    |
| `npm run test:watch`    | Runs Vitest in watch mode                           |
| `npm run test:coverage` | Runs Vitest with coverage                           |
| `npm run test:e2e`      | Builds the app and runs Playwright                  |
| `npm run check`         | Runs all of the checks above, like CI               |

## How pages are rendered

- **First request** (page load, refresh, bots, no JavaScript): the server runs the route's loader, which calls TMDB through a server-side cache. Then it renders the complete HTML with the right status code (200, 404 or 502) and `<head>` tags, and embeds the loaded data. The browser hydrates from that data and does not fetch it again.
- **After hydration**: clicking around is client-side navigation. The same loaders run in the browser and fetch JSON from our `/api` endpoints. The browser never talks to TMDB, so the token stays on the server.
- **Wish list**: stored in a cookie, so the server can render it too. The "Add to wish list" button is a real form: with JavaScript it posts in the background, and without it the server handles the post and redirects back.

Details and the reasons behind each decision: [`specs/data-and-routing.md`](specs/data-and-routing.md).

## Project structure

```
server/              Node-only code
  dev.ts / prod.ts   entry points (dev: Vite as middleware; prod: built to dist/server/index.js)
  app.ts             Express app shared by both modes
  render.ts          runs the router for a request and streams the page into the HTML template
  api/router.ts      /api endpoints the browser calls (backend-for-frontend)
  tmdb/              TMDB client, response mapping and cache
src/                 Code bundled by Vite (runs in the browser, and on the server for SSR)
  entry-client.tsx   hydrates the server-rendered HTML
  entry-server.tsx   runs the router and renders a page on the server
  app/               routes, layout, header, error page, <head> tags
  pages/             one folder per page, with its loader
  features/          films (categories, cards, API client) and wish list (cookie, button, action)
  lib/               small helpers (image URLs, formatting, HTTP errors)
  types/             types and contracts shared with the server
  styles/            global SCSS (tokens, base, category themes, layout)
tests/               shared test setup, TMDB fixtures and mocks, e2e tests
specs/               requirements and specifications
```

The full description of the setup and its rules is in [`specs/project-setup.md`](specs/project-setup.md).

## Troubleshooting

**`Invalid server configuration: TMDB_ACCESS_TOKEN is missing`**
The `.env` file is missing or the token is empty. Run `cp .env.example .env` and paste your token.

**`Error: listen EADDRINUSE: address already in use :::3000`**
Another process uses port 3000. Stop it, or set another port in `.env`, e.g. `PORT=3001`.

**`npm ci` fails with an engine error / syntax errors on start**
Your Node.js version is too old. Run `node -v`; you need 24 or newer.

**Playwright: `Executable doesn't exist`**
Run `npx playwright install chromium` once.
