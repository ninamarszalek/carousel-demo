# Running the project

This guide takes you from a fresh machine to a running copy of the Film Browser, step by step. It covers development mode, production mode, running without a TMDB account, the test suites, and the problems people usually hit.

If you only need the short version, see [Getting started in the README](../README.md#getting-started).

## Contents

1. [What you will end up with](#1-what-you-will-end-up-with)
2. [Prerequisites](#2-prerequisites)
3. [Get a TMDB access token](#3-get-a-tmdb-access-token)
4. [Get the code](#4-get-the-code)
5. [Use the right Node.js version](#5-use-the-right-nodejs-version)
6. [Install dependencies](#6-install-dependencies)
7. [Configure the environment](#7-configure-the-environment)
8. [Run in development mode](#8-run-in-development-mode)
9. [Run without a TMDB token (offline mock)](#9-run-without-a-tmdb-token-offline-mock)
10. [Run in production mode](#10-run-in-production-mode)
11. [Run the tests and quality checks](#11-run-the-tests-and-quality-checks)
12. [Editor setup (optional)](#12-editor-setup-optional)
13. [Reference: URLs, ports and files](#13-reference-urls-ports-and-files)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. What you will end up with

The project is a single Node.js process: an Express server that

- renders every page on the server (SSR) with React, then lets React take over in the browser (hydration),
- serves a small JSON API under `/api` that the browser uses after the first page load,
- talks to [TMDB](https://www.themoviedb.org/) (The Movie Database) to get film data, using a token that stays on the server.

There are two ways to run it:

| Mode        | Command                           | Use it for                                                                                      |
| ----------- | --------------------------------- | ----------------------------------------------------------------------------------------------- |
| Development | `npm run dev`                     | Day-to-day work. Code changes appear immediately; the server restarts when server code changes. |
| Production  | `npm run build`, then `npm start` | Checking the real optimized build, and deploying.                                               |

Both listen on **http://localhost:3000** by default.

## 2. Prerequisites

| Tool    | Required version                                  | How to check    |
| ------- | ------------------------------------------------- | --------------- |
| Node.js | **24 or newer** (pinned in [`.nvmrc`](../.nvmrc)) | `node -v`       |
| npm     | 10 or newer (installed together with Node.js)     | `npm -v`        |
| Git     | any recent version                                | `git --version` |

Why Node.js 24: the server uses `process.loadEnvFile()` to read `.env` and the build targets `node24`. Older versions fail at install time (`npm ci` checks the `engines` field in `package.json`) or with syntax errors on start.

**Installing Node.js.** Any of these works:

- **nvm** (macOS, Linux): `nvm install 24`. The project's `.nvmrc` lets you run `nvm use` later.
- **fnm** (macOS, Linux, Windows): `fnm install 24`. fnm also reads `.nvmrc`.
- **Official installer**: download the current LTS (24.x) or newer from [nodejs.org](https://nodejs.org/).
- **Homebrew** (macOS): `brew install node@24`.

The project works on macOS, Linux and Windows. All `npm` scripts are cross-platform. The only shell-specific parts of this guide are the `cp` command and the inline environment variables in a few examples; Windows equivalents are given next to them.

You also need a **TMDB API Read Access Token** for real film data. The next step explains how to get one. If you can't get one right now, you can still run the app against a local mock: see [section 9](#9-run-without-a-tmdb-token-offline-mock).

## 3. Get a TMDB access token

The token is free.

1. Create an account at [themoviedb.org/signup](https://www.themoviedb.org/signup) and confirm your email address.
2. Open **Settings → API** ([direct link](https://www.themoviedb.org/settings/api)).
3. Request an API key. Choose the **Developer** type and fill in the short form (a personal or learning project is fine).
4. On the same page, copy the **API Read Access Token**. It is a long string that starts with `eyJ…`.

> **Use the Read Access Token, not the "API Key".** The API Key is a short 32-character string. The server sends the token as `Authorization: Bearer <token>` (TMDB v4 auth), which works only with the long Read Access Token.

Treat the token like a password. It goes into your local `.env` file, which git ignores. The server never sends it to the browser, and CI checks that it never appears in the client bundle.

## 4. Get the code

```bash
git clone <repository-url> carousel-demo
cd carousel-demo
```

All commands in the rest of this guide are run from this `carousel-demo` folder.

## 5. Use the right Node.js version

If you use nvm or fnm:

```bash
nvm use        # or: fnm use
```

Either way, confirm the version:

```bash
node -v        # must print v24.x.x or newer
```

## 6. Install dependencies

```bash
npm ci
```

`npm ci` installs the exact versions recorded in `package-lock.json`, which is what CI does too. Use it rather than `npm install`, which may update the lock file.

What happens during the install:

- All runtime and development dependencies are downloaded into `node_modules/`.
- The `prepare` script runs `husky`, which installs a **git pre-commit hook**. From now on, every `git commit` runs ESLint, Stylelint and Prettier on the files you staged (via lint-staged) and fixes what it can. If a problem can't be fixed automatically, the commit is stopped so you can fix it.

You need to run `npm ci` again only when `package-lock.json` changes, for example after pulling someone else's dependency update.

## 7. Configure the environment

The server reads its configuration from environment variables. For local work you keep them in a `.env` file in the project root.

Create it from the template:

```bash
cp .env.example .env          # macOS / Linux
copy .env.example .env        # Windows (cmd)
Copy-Item .env.example .env   # Windows (PowerShell)
```

Open `.env` and paste your token after the `=` sign, with no quotes or spaces:

```dotenv
TMDB_ACCESS_TOKEN=eyJhbGciOiJIUzI1NiJ9.your-token-here
PORT=3000
```

### All variables

| Variable            | Required | Default                        | What it does                                                                                                                                     |
| ------------------- | -------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `TMDB_ACCESS_TOKEN` | **yes**  | none                           | TMDB API Read Access Token. The server refuses to start without it.                                                                              |
| `PORT`              | no       | `3000`                         | Port the HTTP server listens on. Must be an integer from 1 to 65535.                                                                             |
| `TMDB_API_BASE_URL` | no       | `https://api.themoviedb.org/3` | Where TMDB requests go. Change it only to point at a mock (see [section 9](#9-run-without-a-tmdb-token-offline-mock)). Must be an `http(s)` URL. |

### How the values are read

- Both `npm run dev` and `npm start` load `.env` automatically. You don't need `dotenv` or any extra tool.
- **Variables already set in your shell win over `.env`.** That makes one-off overrides easy, e.g. `PORT=3001 npm run dev` (on Windows PowerShell: `$env:PORT=3001; npm run dev`).
- If `.env` doesn't exist, the server simply uses the shell environment. This is how CI and hosting platforms supply the values.
- The configuration is validated once, at startup. If anything is wrong, the server prints **every** problem and exits, so you can fix them all at once:

  ```text
  Invalid server configuration:
    - TMDB_ACCESS_TOKEN is missing. Copy .env.example to .env and set your TMDB API Read Access Token.
    - PORT must be an integer between 1 and 65535 (got "abc").
  ```

Note that the server only checks that the token is **present**. A wrong or expired token is noticed on the first page request, which then shows an error page (see [Troubleshooting](#pages-show-an-error-or-the-api-returns-502)).

## 8. Run in development mode

```bash
npm run dev
```

After a few seconds you should see:

```text
Server listening on http://localhost:3000
```

Open **http://localhost:3000** in your browser. You should see the home page with the **Action**, **Comedy** and **Horror** carousels.

### What development mode does

`npm run dev` starts [`server/dev.ts`](../server/dev.ts) with `tsx watch`. That one process:

- runs Express with **Vite as middleware**, so TypeScript and SCSS are compiled on the fly with no separate build step;
- renders each page on the server and hydrates it in the browser, exactly like production;
- applies changes to `src/**` instantly in the browser (**Hot Module Replacement**), without a full reload where possible;
- **restarts the server** automatically when you change a file under `server/**`;
- uses a second port, **24678**, for the HMR WebSocket. You never open it yourself, but it must be free (see [Troubleshooting](#websocket-server-error-port-24678-is-already-in-use)).

Differences from production you might notice:

- The Content Security Policy is switched off, because Vite injects inline scripts for HMR.
- Assets are not compressed or cached, and the first page load after a start can take a moment while Vite pre-bundles dependencies.
- Error stack traces point to your original `.ts`/`.tsx` source lines.

### Check that it works

With the server running, in a second terminal:

```bash
curl http://localhost:3000/healthz
# {"status":"ok"}

curl http://localhost:3000/api/genres/28/films
# a JSON array of action films from TMDB
```

`/healthz` only proves the server is up. The `/api` call proves that your TMDB token works too.

Then try the app itself:

1. On the home page, drag or swipe a carousel, or use the arrow keys.
2. Click a film to open its details page (`/film/<id>`). The page takes on the theme of the film's category.
3. Click **Add to wish list**, then open the wish list from the header (`/wishlist`).

### Stop the server

Press **Ctrl+C**. The server finishes in-flight requests and closes Vite before exiting (it gives up and exits after 10 seconds if something hangs).

## 9. Run without a TMDB token (offline mock)

The end-to-end tests use a tiny local stand-in for TMDB that serves a fixed set of films. You can use it to run the app with no TMDB account and no internet connection, for example to look around before you have a token.

Open **two terminals** in the project folder.

**Terminal 1**: start the mock on port 4174:

```bash
npx tsx tests/e2e/tmdb-mock-server.ts 4174
# TMDB mock listening on http://localhost:4174/3
```

**Terminal 2**: start the app and point it at the mock. The token only has to be non-empty here, because the mock doesn't check it:

```bash
# macOS / Linux
TMDB_ACCESS_TOKEN=offline TMDB_API_BASE_URL=http://localhost:4174/3 npm run dev
```

```powershell
# Windows (PowerShell)
$env:TMDB_ACCESS_TOKEN="offline"; $env:TMDB_API_BASE_URL="http://localhost:4174/3"; npm run dev
```

The same variables work with `npm start` (after `npm run build`).

Keep in mind:

- The mock only knows a handful of films (from [`tests/mocks/tmdb/fixtures.ts`](../tests/mocks/tmdb/fixtures.ts)), so carousels are short.
- **Posters will be broken images.** The fixtures use made-up poster paths, and images are still loaded from TMDB's image server. Everything else (pages, navigation, carousels, wish list) works.
- If your `.env` contains a real `TMDB_API_BASE_URL` line, the shell value above still wins, as described in [section 7](#how-the-values-are-read).

## 10. Run in production mode

### Build

```bash
npm run build
```

This runs two Vite builds, one after the other:

| Step                                | Output         | Contents                                                                                                                               |
| ----------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `build:client` (`vite build`)       | `dist/client/` | Browser JavaScript and CSS with content-hashed names in `assets/`, `favicon.svg`, and `index.html`, which is the HTML template for SSR |
| `build:server` (`vite build --ssr`) | `dist/server/` | `index.js` (the server entry point, from [`server/prod.ts`](../server/prod.ts)) and `entry-server.js` (the React SSR renderer)         |

The build doesn't need the TMDB token or the network.

### Start

```bash
npm start
```

This runs `node dist/server/index.js`, which:

- loads `.env` (if present) and validates the configuration, exactly like dev mode;
- sets `NODE_ENV=production` itself, so React and Express use their production code. You don't need to set it, and the command is the same on every OS;
- serves `dist/client/` with gzip compression, and lets browsers cache `assets/*` for a year (safe, because the file names change whenever the content does);
- sends a strict Content Security Policy and other security headers (via Helmet).

Open **http://localhost:3000** and check `/healthz` as in [section 8](#check-that-it-works). Stop the server with **Ctrl+C** (or `SIGTERM`).

> **Rebuild after every code change.** `npm start` serves whatever is in `dist/`. It doesn't watch files and doesn't rebuild.

### Deploying to a server

The production server is not a single self-contained file: `dist/server/` imports its runtime dependencies (`express`, `react`, `react-router`, `helmet`, `compression` and `isbot`) from `node_modules`. On the target machine you need:

1. Node.js 24 or newer.
2. The `dist/` folder from `npm run build`, together with `package.json` and `package-lock.json`.
3. Only the runtime dependencies:

   ```bash
   npm ci --omit=dev --ignore-scripts
   ```

   `--ignore-scripts` skips the `prepare` script, which would try to install the git hook with Husky, a dev dependency that isn't installed here.

4. The environment variables. Set `TMDB_ACCESS_TOKEN` (and `PORT` if your platform requires a specific one) in the platform's settings, rather than copying `.env` to the server.
5. Start with `npm start` or `node dist/server/index.js`.

Point your platform's health check at **`GET /healthz`**, which returns `200 {"status":"ok"}`. The server shuts down gracefully on `SIGTERM`, which is what most platforms and container runtimes send.

Film data is cached **in memory** inside each server process, so a restart starts with an empty cache. Nothing else is stored on the server: the wish list lives in the visitor's `wishlist` cookie.

## 11. Run the tests and quality checks

### Unit, component, SSR and server tests (Vitest)

```bash
npm test               # run once
npm run test:watch     # re-run on every change
npm run test:coverage  # run once and write a coverage report
```

These need no token and no network: TMDB is mocked. Two Vitest projects run side by side:

- **client**: `src/**/*.test.{ts,tsx}` in a simulated browser (jsdom);
- **server**: `server/**/*.test.ts` and `src/**/*.ssr.test.{ts,tsx}` in Node.

`test:coverage` fails if line, statement, function or branch coverage drops below **80%**. Open `coverage/index.html` in a browser to see the report file by file.

### End-to-end tests (Playwright)

Install the test browser once (about 150 MB):

```bash
npx playwright install chromium
# Linux machines may also need system libraries:
npx playwright install --with-deps chromium
```

Then run:

```bash
npm run test:e2e
```

This builds the app and runs Playwright, which automatically starts:

- the TMDB mock on port **4174**;
- the production server on port **4173**, pointed at the mock.

So the e2e tests also need no token or network, and they always see the same films. Some of them run with **JavaScript disabled**, to prove the pages are rendered on the server and that the wish list form works as plain HTML.

Useful variations:

```bash
npx playwright test                    # skip the rebuild (only if dist/ is up to date)
npx playwright test --ui               # interactive runner: pick tests, watch them, time-travel
npx playwright test --headed           # watch the browser while tests run
npx playwright test tests/e2e/carousel.spec.ts   # run a single file
npx playwright show-report             # open the HTML report after a run with failures
```

Locally, Playwright **reuses** anything already listening on ports 4173 and 4174 instead of starting its own server. If you left an old server running there, the tests may run against stale code; stop it first.

### Static checks

```bash
npm run typecheck      # TypeScript (tsc -b), all projects
npm run lint           # ESLint, type-aware, zero warnings allowed
npm run lint:fix       # ESLint with auto-fix
npm run lint:styles    # Stylelint for SCSS
npm run format:check   # Prettier, check only
npm run format         # Prettier, rewrite files
```

### Everything CI runs

```bash
npm run check
```

This runs type checking, both linters, the formatting check, the tests with coverage, and the e2e tests, in that order, and stops at the first failure. If it passes locally, the [CI workflow](../.github/workflows/ci.yml) should pass too. CI additionally checks that the token never ends up in `dist/client`.

## 12. Editor setup (optional)

The repository includes shared VS Code settings ([`.vscode/settings.json`](../.vscode/settings.json)). When you open the folder, VS Code suggests these extensions ([`.vscode/extensions.json`](../.vscode/extensions.json)):

- ESLint, Stylelint, Prettier and EditorConfig, for the same linting and formatting as the command line and the pre-commit hook;
- Vitest Explorer, to run unit tests from the editor;
- Playwright Test, to run and debug e2e tests from the editor.

Other editors work too. Respect [`.editorconfig`](../.editorconfig) and run Prettier on save.

## 13. Reference: URLs, ports and files

### Pages

| URL           | Page                                                     |
| ------------- | -------------------------------------------------------- |
| `/`           | Home: one carousel per category (Action, Comedy, Horror) |
| `/film/:id`   | Film details, using the TMDB film id, e.g. `/film/603`   |
| `/wishlist`   | Wish list                                                |
| anything else | "Not found" page with HTTP status 404                    |

### API and health check

| URL                         | Returns                                                 |
| --------------------------- | ------------------------------------------------------- |
| `GET /healthz`              | `{"status":"ok"}`, for uptime and readiness checks      |
| `GET /api/genres/:id/films` | Films in a TMDB genre (28 Action, 35 Comedy, 27 Horror) |
| `GET /api/films/:id`        | One film's details, or 404                              |
| `GET /api/films?ids=1,2,3`  | Several films at once (used by the wish list)           |

API errors are JSON (`{"error": "..."}`). If TMDB fails or rejects the token, the API answers **502**.

### Ports

| Port  | Used by                                                  |
| ----- | -------------------------------------------------------- |
| 3000  | The app, in dev and production (change with `PORT`)      |
| 24678 | Vite HMR WebSocket, dev mode only                        |
| 4173  | Production server started by Playwright during e2e tests |
| 4174  | TMDB mock (e2e tests, or offline mode from section 9)    |

### Generated folders (all git-ignored, safe to delete)

| Folder                                | Created by              |
| ------------------------------------- | ----------------------- |
| `node_modules/`                       | `npm ci`                |
| `dist/`                               | `npm run build`         |
| `coverage/`                           | `npm run test:coverage` |
| `test-results/`, `playwright-report/` | Playwright              |

## 14. Troubleshooting

### `Invalid server configuration: TMDB_ACCESS_TOKEN is missing`

`.env` doesn't exist, isn't in the project root, or the token after `=` is empty. Run `cp .env.example .env` and paste the token. Make sure you start the server from the project root, because `.env` is looked up in the current folder.

### Pages show an error, or the API returns 502

The server started, but TMDB rejected or didn't answer its requests. The terminal running the server logs the TMDB error. Check that:

- you copied the **API Read Access Token** (long, starts with `eyJ`), not the short API Key;
- there are no quotes, spaces or line breaks around the token in `.env`;
- you can reach `api.themoviedb.org` from your network (some corporate networks and VPNs block it).

You can test the token directly:

```bash
curl -H "Authorization: Bearer <your-token>" https://api.themoviedb.org/3/configuration
```

A JSON response means the token is fine; `401` means it is wrong.

### `Error: listen EADDRINUSE: address already in use :::3000`

Something else is using port 3000, often another copy of this app. Stop it, or use another port: set `PORT=3001` in `.env`, or run `PORT=3001 npm run dev`.

To find what is using the port: `lsof -i :3000` (macOS, Linux) or `netstat -ano | findstr :3000` (Windows).

### `WebSocket server error: Port 24678 is already in use`

Another Vite dev server (perhaps from another project, or a second `npm run dev`) holds the HMR port. The page still loads, but changes won't appear in the browser automatically. Stop the other dev server and restart `npm run dev`.

### `npm ci` fails with `EBADENGINE`, or the server fails with syntax errors

Your Node.js is older than 24. Run `node -v`, then switch versions (`nvm use`) or install Node.js 24 or newer ([section 2](#2-prerequisites)).

### `npm ci` fails because `package-lock.json` is out of sync

`package.json` was changed without updating the lock file. If you changed dependencies yourself, run `npm install` once to update `package-lock.json` and commit it. Otherwise, pull the latest changes.

### `npm start` fails with `ENOENT ... dist/client/index.html` or `Cannot find module ... dist/server/index.js`

There is no build yet, or it is incomplete. Run `npm run build` first.

### Production shows old code

`npm start` serves the last build. Run `npm run build` again after changing code.

### Playwright: `Executable doesn't exist`

The test browser isn't installed. Run `npx playwright install chromium` once. On Linux, use `npx playwright install --with-deps chromium` if it complains about missing libraries.

### E2E tests fail with odd results, or time out waiting for the server

- A stale server may be running on port 4173 or 4174 and Playwright is reusing it. Stop it and run again.
- Ports 4173 and 4174 must be free, so the offline mock from section 9 can't be running at the same time.
- `npx playwright test` doesn't rebuild. Use `npm run test:e2e` to make sure `dist/` matches your code.

### The commit is rejected by the pre-commit hook

lint-staged found a lint or formatting problem it couldn't fix. Read the output, fix the file, `git add` it, and commit again. Run `npm run lint` and `npm run lint:styles` to see all problems at once.

### Starting over from a clean state

```bash
rm -rf node_modules dist coverage test-results playwright-report
npm ci
npm run build
```
