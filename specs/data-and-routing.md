# Spec — Routing, Data Loading and SSR Strategy

Status: **Implemented** (2026-11-15). Section 13 lists where the implementation differs from this draft, and why.
Covers requirements: CTX-3, FR-HOME-1..3, FR-DET-1..4, FR-CAT-1..3 (only how the category is resolved; the visual themes get their own spec), FR-WISH-1, TECH-SSR-1, TECH-LIB-1, TECH-API-1, EVAL-1, EVAL-5, EVAL-6, EVAL-7 (see [requirements.md](requirements.md)).
Builds on: [project-setup.md](project-setup.md) (§9 server, §11 testing).

## 1. Goal

Define how a URL becomes a page with data, on the server and in the browser, so that:

- every page is **complete HTML on the first request**: readable without JavaScript, by bots, and with the right HTTP status (EVAL-7),
- after hydration the app behaves like an **SPA**: navigation does not reload the page,
- **one route definition and one set of loaders** serve both sides, and only the data source differs (EVAL-1, EVAL-5),
- the TMDB token **never leaves the server** (project-setup §9.2),
- adding to the wish list **works without JavaScript too** (progressive enhancement).

Out of scope: the visual design of the pages, the carousel's look and behaviour, and the category themes (fonts, buttons). Each gets its own spec. This spec only defines the data and the hooks that those specs use (for example `data-category`).

## 2. Decisions

| #   | Decision            | Choice                                                                                                                                        | Why                                                                                                                                                                                                                                                                                              |
| --- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | Router              | **React Router 8, data mode** (`createStaticHandler` / `createBrowserRouter`). Not framework mode.                                            | Official API for SSR on our own server. It gives status codes, data serialization and hydration. It is a library, not a framework (TECH-HAND-2). TanStack Router was rejected: SSR without TanStack Start is less documented, and its main strength, typed params, matters little with 3 routes. |
| D2  | Categories          | **3 TMDB genres**: Action (28), Comedy (35), Horror (27).                                                                                     | Genres give natural, clearly different themes (FR-CAT). TMDB lists such as "popular" do not.                                                                                                                                                                                                     |
| D3  | Category of a film  | **In the URL as a search param**: `/film/603?category=action`. Without a valid param, the category comes from the film's genres.              | A film clicked in the Comedy carousel always opens in the Comedy theme. The fallback covers links from the wish list or from outside the app.                                                                                                                                                    |
| D4  | Wish list           | **Cookie** with ids and categories, plus a **`/wishlist` page**.                                                                              | The server knows the list, so `/wishlist` and the header counter are rendered on the server, with no hydration mismatch. No-JS form posts work.                                                                                                                                                  |
| D5  | Data loading on SSR | **Loaders always wait for their data.** No deferred promises in loader data.                                                                  | `StaticRouterProvider` serializes loader data with plain `JSON.stringify` (checked in 8.5.1), so promises would not survive hydration. The server-side TMDB cache (§5.3) keeps waiting short.                                                                                                    |
| D6  | Data access         | **One `FilmsApi` interface**, with a server implementation (TMDB) and a browser implementation (`fetch('/api/…')`), injected into the routes. | Loaders do not know where they run (EVAL-5). This keeps the `src` ↛ `server` import boundary. Tests inject a fake.                                                                                                                                                                               |

## 3. Request lifecycle

### 3.1 First request (full page load, bots, no JS)

```
Browser / bot          Express                                  entry-server (src)             TMDB
     │ GET /film/603?category=action                                   │                           │
     ├─────────────────────►│ toFetchRequest(req)                      │                           │
     │                      ├─ entry.handle(request, {films, nonce}) ─►│ staticHandler.query()     │
     │                      │                                          │ runs root + film loaders  │
     │                      │                                          ├─ films.getFilm(603) ─────►│ (cached)
     │                      │                                          │◄──────────────────────────┤
     │                      │◄─ { statusCode, head, render } ──────────┤                           │
     │                      │ splitTemplate(template, head)            │                           │
     │                      │ render() → renderToPipeableStream        │                           │
     │◄─────────────────────┤ HTML + <script nonce>window.__staticRouterHydrationData = …</script>  │
     │ JS loads → createBrowserRouter reads the hydration data → hydrateRoot (no refetch)            │
```

- The status code comes from the router: 200, 404 (unknown route or film) or 502 (TMDB failure, §7).
- `<head>` tags (title, description, Open Graph, canonical) are built from the matched routes and passed to `splitTemplate()` (§6). The data is already loaded, so users and bots get the same `<head>`.
- User vs bot timing (`onShellReady` / `onAllReady`) works as before. With D5, the two are almost the same. The split stays for any future `Suspense` boundaries, for example lazy components.

### 3.2 Navigation in the browser (after hydration)

```
Browser (router)                          Express /api                      TMDB
     │ click → /film/550?category=comedy       │                               │
     │ runs the same film loader               │                               │
     ├─ fetch /api/films/550 ─────────────────►│ films.getFilm(550) (cached) ─►│
     │◄──────────────────────── JSON ──────────┤◄──────────────────────────────┤
     │ React renders the new page (no reload)
```

- No HTML is sent, only JSON from our BFF. The browser never talks to TMDB.
- During navigation the old page stays on screen. A global progress indicator uses `useNavigation()`.

### 3.3 Fallback: SSR shell failed

This is unchanged from project-setup §9.2. The server sends an empty `#root` with status 500. `entry-client.tsx` then calls `createRoot().render()`, and the router runs all loaders in the browser through `/api`.

## 4. Routes

Defined once in `src/app/routes.tsx` as `createRoutes(deps: RouteDeps): RouteObject[]`. Both entries call it, each with its own dependencies.

| Path                  | Page                                                                    | Loader data                                                      | Action                     | Status codes  |
| --------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------- | ------------- |
| _root_ (`id: "root"`) | `RootLayout`: header, `<Outlet/>`, progress bar, `<ScrollRestoration/>` | `{ wishlist: WishlistItem[] }` from the cookie                   | —                          | —             |
| `/`                   | `HomePage`                                                              | `CategoryRow[]`: one row per category (§4.1)                     | —                          | 200, 502      |
| `/film/:id`           | `FilmDetailsPage`                                                       | `{ film: FilmDetails, category: CategorySlug \| null }`          | wish list `add` / `remove` | 200, 404, 502 |
| `/wishlist`           | `WishlistPage`                                                          | `{ films: WishlistEntry[] }`: cookie items joined with film data | wish list `remove`         | 200, 502      |
| `*`                   | `RouteError`                                                            | —                                                                | —                          | 404           |

- An **error element** on the root route (`RouteError`) renders 404 and 5xx pages inside the layout, so the header stays.
- **Param validation** lives in one helper, `parseFilmId(param): number | null`, which accepts positive integers only. An invalid id throws a 404 `data()` before any API call. An invalid `?category=` is **ignored**, not a 404: it falls back as described in D3.
- `/film/:id` adds `<link rel="canonical" href="/film/:id">`, because the `?category` variants are the same film.
- No route-level code splitting: there are only 3 small pages, and lazy routes would need `manifest`/`ssrManifest` (project-setup §9.1). This can be revisited later.

### 4.1 Home loader

```ts
type CategoryRow =
  | { category: Category; status: 'ok'; films: FilmSummary[] }
  | { category: Category; status: 'error' };
```

- The loader loads the 3 categories in parallel. **One failing category does not break the page**: its carousel shows an inline error with a "Try again" link to `/` (a navigation to the same URL runs the loaders again; without JavaScript it reloads the page).
- If **all** categories fail, the loader throws 502, and the page shows the error element.

### 4.2 Category resolution (D3)

`resolveCategory(param: string | null, genres: Genre[]): CategorySlug | null` is a pure function:

1. If `param` is a known category slug → that slug.
2. Otherwise → the first category, in carousel order, whose genre id is in the film's genres.
3. Otherwise → `null`, which means the default theme.

The detail page puts the result on its root element as `data-category="action|comedy|horror"`. Without a category it has no attribute. The themes spec styles this attribute. Links from a carousel always add `?category=<slug>`.

## 5. Data layer

### 5.1 Domain types: `src/types/`

`server/**` may import `src/types/**` (project-setup §4), so both sides share these types.

```ts
// src/types/film.ts
interface Genre {
  id: number;
  name: string;
}
interface FilmSummary {
  id: number;
  title: string;
  posterPath: string | null;
  releaseYear: number | null;
  rating: number | null; // vote_average, null if there are no votes
  genreIds: number[];
}
interface FilmDetails extends Omit<FilmSummary, 'genreIds'> {
  overview: string;
  tagline: string | null;
  backdropPath: string | null;
  genres: Genre[];
  releaseDate: string | null;
  runtimeMinutes: number | null;
  voteCount: number;
  originalLanguage: string;
  directors: string[];
  cast: CastMember[]; // top 6 by billing order
}
interface CastMember {
  id: number;
  name: string;
  character: string;
  profilePath: string | null;
}

// src/types/films-api.ts
interface FilmsApi {
  getFilmsByGenre(genreId: number, signal?: AbortSignal): Promise<FilmSummary[]>;
  /** null when the film does not exist (TMDB 404). */
  getFilm(id: number, signal?: AbortSignal): Promise<FilmDetails | null>;
  /** For the wish list. Unknown ids are skipped, and the order of `ids` is kept. */
  getFilms(ids: readonly number[], signal?: AbortSignal): Promise<FilmSummary[]>;
}
```

The categories (slug, label, genre id) are a frontend concept, so they live in `src/features/films/categories.ts`. The server works only with genre ids.

### 5.2 Server: TMDB client and BFF

```
server/tmdb/
  dto.ts            TMDB response types (only the fields we use)
  client.ts         fetch wrapper: base URL, Bearer token, language=en-US, 5 s timeout, TmdbError
  mappers.ts        DTO → domain (null-safe, trims empty strings to null)
  cache.ts          TTL cache with in-flight de-duplication
  films-service.ts  createTmdbFilmsApi(client, cache): FilmsApi
server/api/router.ts  /api routes on top of FilmsApi
```

- **Client:** each call uses `AbortSignal.any([callerSignal, AbortSignal.timeout(5000)])`, so a closed request or a slow TMDB never hangs the server. TMDB 404 → `null`. Other non-2xx responses, network errors and timeouts → `TmdbError`.
- **TMDB calls:**
  - `getFilmsByGenre`: `/discover/movie?with_genres=<id>&sort_by=popularity.desc&include_adult=false&vote_count.gte=100&page=1`, which gives 20 films,
  - `getFilm`: `/movie/<id>?append_to_response=credits`,
  - `getFilms`: `getFilm` per id, in parallel, through the cache, at most 50 ids.
- **Config:** a new optional `TMDB_API_BASE_URL` (default `https://api.themoviedb.org/3`), validated in `config.ts`. It exists so e2e tests can point the server at a local mock (§9).
- **Mapping:** no schema library. The DTO types and defensive mappers are tested against recorded fixtures. Any field that can be missing in TMDB maps to `null`, never `undefined` or `""`.

**BFF endpoints** (JSON):

| Endpoint                    | Response        | Errors                            | Cache-Control          |
| --------------------------- | --------------- | --------------------------------- | ---------------------- |
| `GET /api/genres/:id/films` | `FilmSummary[]` | 400 bad id, 502 TMDB error        | `public, max-age=300`  |
| `GET /api/films/:id`        | `FilmDetails`   | 400 bad id, 404 unknown film, 502 | `public, max-age=3600` |
| `GET /api/films?ids=1,2,3`  | `FilmSummary[]` | 400 bad/too many ids, 502         | `private, max-age=60`  |

Error body: `{ "error": string }`. Unknown `/api/*` routes stay a JSON 404.

### 5.3 Server cache

- An in-memory `Map` with a TTL and a size cap of 500 entries; the oldest entries are dropped first. Genre lists are kept for 10 min, film details for 1 h.
- **In-flight de-duplication**: concurrent requests for the same key share one TMDB call. This matters on a cold start, when the home page asks for 3 lists at once.
- **Errors are not cached.** `null` (TMDB 404) is cached for 10 min, so bots cannot hammer TMDB with unknown ids.
- One cache per server process, created in `createApp()`. It is not shared between instances, which is good enough for this app.

### 5.4 Browser: `createHttpFilmsApi()`

`src/features/films/api/http-films-api.ts` implements `FilmsApi` with `fetch('/api/…', { signal })`. 404 → `null`. Other errors → `ApiError(status)`, which loaders rethrow as `data(…, { status })`. The router passes `request.signal` to loaders, so a navigation that gets replaced cancels its fetches.

## 6. SSR integration

### 6.1 New `SsrEntry` contract (`server/render.ts`)

```ts
export interface SsrContext {
  films: FilmsApi; // server implementation, created once in createApp()
  nonce: string; // per-request CSP nonce (§6.3)
}

export type SsrResult =
  /** The router answered with a Response: redirect after a no-JS POST, 405, … Sent as-is. */
  | { kind: 'response'; response: Response }
  /** Data is loaded; the caller starts the stream with its own callbacks. */
  | {
      kind: 'render';
      statusCode: number;
      head: string;
      render: (options: RenderToPipeableStreamOptions) => PipeableStream;
    };

export interface SsrEntry {
  handle(request: Request, context: SsrContext): Promise<SsrResult>;
}
```

- **`entry-server.tsx`**: `createStaticHandler(createRoutes(serverDeps))` → `query(request)`. If the result is a `Response`, it returns `kind: 'response'`. Otherwise it builds `head` from the matches (§6.2) and returns a `render` that wraps `<StaticRouterProvider router context nonce>` in `<StrictMode>`. The static handler is created once per `FilmsApi` instance, memoized in a `WeakMap`, and not once per request.
- **`server/render.ts`**: converts the Express request (§6.4), calls `handle()`, and then either sends the `Response` or streams with `statusCode` instead of a fixed 200. Bot handling, the timeout and the shell-error fallback stay as they are. `hasRenderError` can still raise the status to 500.
- **`entry-client.tsx`**: `createBrowserRouter(createRoutes(clientDeps))`. It reads `window.__staticRouterHydrationData` itself. Then it calls `hydrateRoot` or `createRoot` as today, with `<RouterProvider>`.
- **Data serialization**: `StaticRouterProvider` writes `loaderData`, `actionData` and `errors` into an inline script, using `JSON.stringify` twice plus `escapeHtml` (checked in 8.5.1). This meets the "escape `<`, no XSS through JSON" rule from project-setup §9.2. An SSR test still asserts it with a film title that contains `</script>`.

### 6.2 Document head

- Each route can define `handle.head(data): HeadData` (`{ title, description?, image?, canonicalPath? }`). The deepest match that defines `head` wins. Otherwise the defaults apply ("Film Browser" plus the site description).
- `buildHead(matches): HeadData` is shared by both sides:
  - **Server:** `serializeHead(head)` turns it into escaped `<title>`, `<meta name="description">`, `og:title`/`og:description`/`og:image` and `<link rel="canonical">`, and puts them into `<!--app-head-->`. The static `<title>` and `<meta name="description">` move out of `index.html`, so they are not duplicated.
  - **Browser:** `<DocumentTitle/>` in `RootLayout` sets `document.title` after each navigation. Other meta tags matter only for bots, and bots always get server HTML.

### 6.3 CSP nonce

Production CSP blocks inline scripts, but the hydration data is an inline script.

- `createApp()` adds a middleware that sets `res.locals.cspNonce = randomBytes(16).toString('base64')` for every request.
- The helmet `script-src` becomes `'self'` plus `(req, res) => \`'nonce-${res.locals.cspNonce}'\``.
- The nonce goes to `StaticRouterProvider` (`nonce` prop) and to `renderToPipeableStream` (`nonce` option, for React's own streaming scripts).
- The existing e2e "no console errors" check catches CSP violations.

### 6.4 Express ↔ Fetch bridge (`server/http/fetch-bridge.ts`)

- `toFetchRequest(req, res)`: builds the absolute URL from `req.protocol`, `req.host` and `req.originalUrl`, copies the headers, and uses an `AbortSignal` that fires on `res.on('close')`. The body is read only for `POST`, limited to **2 KB** (larger bodies → 413), and passed as a string.
- `sendFetchResponse(res, response)`: copies the status and headers (`Set-Cookie` through `headers.getSetCookie()`, so multiple cookies survive), then the body.
- The SSR handler accepts `GET`, `HEAD` and `POST`. Other methods → 405.
- A `POST` with `Sec-Fetch-Site: cross-site` → 403. This is a cheap CSRF guard. The only thing a forged post could do is change someone's wish list, but rejecting it costs nothing.
- HTML responses get `Cache-Control: private, no-cache` and `Vary: User-Agent, Cookie`, because the header shows the user's wish list.

## 7. Errors and status codes

| Situation                     | `/api` response | Page                                                     |
| ----------------------------- | --------------- | -------------------------------------------------------- |
| Unknown path                  | JSON 404        | error element "Page not found", 404                      |
| Invalid film id (`/film/abc`) | 400             | error element "Film not found", 404                      |
| Film not in TMDB              | 404             | error element "Film not found", 404                      |
| One home category fails       | 502 (that call) | page 200, that carousel shows an inline error with retry |
| TMDB down / timeout           | 502             | error element "Couldn't load films" with retry, 502      |
| Bug while rendering           | —               | `hasRenderError` → 500, or the shell fallback (§3.3)     |

Loaders throw `data(message, { status })`. `RouteError` uses `isRouteErrorResponse()` to pick the message. Unexpected errors show a generic message, and the details are only logged on the server.

## 8. Wish list

### 8.1 Storage

- **Cookie** `wishlist`, with the value `encodeURIComponent("603:action,550:comedy,27205")`. The newest item comes first, and the category is optional. Flags: `Path=/; Max-Age=31536000; SameSite=Lax`.
  - It is **not HttpOnly**, because the browser writes it (§8.2). The content is not sensitive.
  - It is **not Secure**, because the app must also work over plain HTTP locally. Behind HTTPS, the proxy can add the flag.
- `src/features/wishlist/wishlist-cookie.ts` holds pure, shared functions: `parseWishlist(value)`, which drops invalid entries and duplicates and keeps **at most 50** items, `serializeWishlist(items)`, `addItem` and `removeItem`.
- `WishlistStorage` is injected like `FilmsApi`:

```ts
interface WishlistStorage {
  read(request: Request): WishlistItem[];
  /** Server: 303 redirect to request.url with Set-Cookie. Browser: writes document.cookie, returns null. */
  save(items: WishlistItem[], request: Request): Response | null;
}
```

The server implementation lives in `entry-server.tsx` and reads the `Cookie` header of the request. The browser implementation reads `document.cookie`, because cookies are not exposed on the router's `Request` in the browser.

### 8.2 Add and remove

- The detail page renders `<fetcher.Form method="post">` with `intent=add|remove`, the film id and the category. The button toggles between "Add to wish list" and "Remove from wish list" (FR-DET-3, FR-DET-4).
- **With JS:**
  1. The route action runs in the browser and calls `storage.save()`, which writes the cookie.
  2. The router revalidates, so the root loader updates the header counter.
  3. `fetcher.formData` gives an optimistic label right away.
- **Without JS:** the form posts natively to the same URL.
  1. Express → `query()` → the same action → `storage.save()` returns a 303 redirect with `Set-Cookie`.
  2. The browser does a GET on the page again (Post/Redirect/Get).
- The action validates its input (`intent`, id, category) and returns 400 for bad input.

### 8.3 `/wishlist` page

- The loader reads the items, calls `films.getFilms(ids)`, and joins the result into `WishlistEntry` (`{ film: FilmSummary; category: CategorySlug | null }`). Items that TMDB no longer knows are skipped.
- The page shows a grid of cards. Each card links to `/film/:id?category=…` and has a remove button, a `fetcher.Form` with `intent=remove`. There is an empty state with a link to the home page (FR-WISH-1).
- The header shows "Wish list" with a count from the root loader. The accessible name is "Wish list, 3 films".

## 9. Testing (EVAL-6)

| Level                    | What                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit                     | `mappers` (against fixtures), `cache` (TTL, de-duplication, errors not cached), `resolveCategory`, `parseFilmId`, `wishlist-cookie` (parse/serialize/limits/garbage), `buildHead`, `serializeHead` (escaping)                                                                                                                                                                                    |
| Server (supertest + MSW) | `/api/*`: happy paths, 400/404/502, `Cache-Control`. TMDB is mocked with MSW in node, and the Bearer header is asserted. The SSR handler is tested with a fake `SsrEntry`: `kind: 'response'` passthrough with `Set-Cookie`, status from `statusCode`, 405, 413, cross-site POST 403, nonce in the CSP header                                                                                    |
| SSR (`*.ssr.test.ts`)    | `entry-server.handle()` with a fake `FilmsApi`: HTML contains carousel titles; 404 for an unknown film and an invalid id; `<head>` tags; `?category` → `data-category`; hydration script has the nonce and escapes `</script>`; a POST action returns a 303 with `Set-Cookie`                                                                                                                    |
| Component (RTL)          | Pages rendered with `createMemoryRouter(createRoutes(fakeDeps))`: home rows and the inline error with retry, detail page add/remove, wish list empty state and remove, header counter after an action                                                                                                                                                                                            |
| E2E (Playwright)         | The production server is started with `TMDB_API_BASE_URL` pointing at a small fixture server (`tests/e2e/tmdb-mock.ts`), and `image.tmdb.org` requests are answered by `page.route()`. Flows: home → film → add → wish list → remove. A direct load of `/film/:id` returns 404 for an unknown film. **No-JS** runs: home, detail page and adding to the wish list through the form post all work |

Fixtures (`tests/mocks/tmdb/fixtures.ts`) are hand-written in the exact TMDB response shape and typed with the DTOs. MSW handlers and the e2e mock server answer from them through one shared resolver.

## 10. Directory changes

```
server/
  csp.ts                         per-request nonce + production CSP
  http/fetch-bridge.ts           Express ↔ Fetch Request/Response
  tmdb/{client,dto,mappers,cache,films-service,index}.ts (+ tests)
  api/router.ts                  BFF routes (§5.2)
src/
  types/{film,films-api,ssr}.ts  domain models, FilmsApi + parseId + FilmServiceError, SsrEntry contract
  app/{routes.tsx, head.ts, DocumentTitle.tsx, RootLayout/, Header/, RouteError/}
  pages/{HomePage,FilmDetailsPage,WishlistPage}/   page + its loader (+ styles)
  features/films/{categories.ts, api/http-films-api.ts, components/{FilmPoster,FilmCard,FilmRow}/}
  features/wishlist/{wishlist-cookie.ts, wishlist-storage.ts, wishlist-action.ts, use-wishlist.ts, components/WishlistButton/}
  lib/{tmdb-image,format,http-error}.ts
tests/
  mocks/tmdb/{fixtures,resolve,handlers,setup-tmdb-server}.ts   TMDB fixtures, shared by MSW and the e2e mock
  mocks/{fake-films-api,memory-wishlist-storage}.ts              fakes for SSR and component tests
  e2e/tmdb-mock-server.ts        fixture server for Playwright
  e2e/{fixtures,browsing.spec,no-javascript.spec}.ts
```

## 11. Implementation plan

Each step ends with `npm run check` green and a commit.

1. **Router plumbing.** Install `react-router`. Then build:
   - `createRoutes`, `RootLayout` with the header, `RouteError` (also the 404 page),
   - the new `SsrEntry` contract and the fetch bridge,
   - `statusCode` and head handling, the CSP nonce.

   The home page still shows static content. Check: 404 for an unknown path, and hydration without console errors.

2. **TMDB + BFF.** Domain types, the TMDB client, mappers, cache, `FilmsApi`, the `/api` routes, fixtures with MSW, and `TMDB_API_BASE_URL` with the e2e mock server.
3. **Home data.** Home loader and `CategoryRow`, `createHttpFilmsApi`. Each category is shown as a simple list for now, linking to `/film/:id?category=…`. The carousel comes in its own spec.
4. **Detail page data.** Film loader, `resolveCategory`, `data-category`, head tags, canonical link, 404/502 handling. Minimal markup: image, description, button placeholder, additional info.
5. **Wish list.** Cookie helpers, `WishlistStorage`, the actions, the `/wishlist` page, the header counter, and the no-JS e2e flow.

After this spec come the **carousel spec**, then the **detail page layout and category themes spec**.

## 12. Risks (resolved during implementation)

- **React Router 8 API.** Everything the draft relied on exists in 8.5.1. `RouterProvider` for the DOM comes from `react-router/dom` (it wires up `flushSync`). Hydration produces no warnings: every e2e test fails on any console error. Route dependencies are passed by closure (`createRoutes(deps)`), not through the router context API, which has changed between majors.
- **Express 5 + Fetch.** `req.host` includes the port, in dev too (checked in a `fetch-bridge` test and by hand with `npm run dev`).
- **Deferred data (D5).** Still out of scope. A slow, non-critical section would need its own streaming serialization.

## 13. Changes from the draft

| Draft                                                       | Implemented                                                                        | Why                                                                                                                                                     |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SsrEntry` contract in `server/render.ts`                   | `src/types/ssr.ts`, re-exported by `server/render.ts`                              | `entry-server.tsx` can now type-check against it too. `src/types` is the only part of `src` that both sides may import.                                 |
| `parseFilmId` in `features/films`                           | `parseId` in `src/types/films-api.ts`                                              | The server validates ids in `/api` with the same rule (DRY), and the server may only import `src/types`.                                                |
| loaders catch `ApiError` / `TmdbError` separately           | one `FilmServiceError` in `src/types/films-api.ts`; `TmdbError` extends it         | Loaders run on both sides and must recognise "the film service is down" (→ 502) without importing server code. Other errors stay 500 (bugs).            |
| `FilmsApi` with method signatures                           | function-valued properties                                                         | Methods can be passed around (`films.getFilm`) without `this` problems; enforced by `@typescript-eslint/unbound-method`.                                |
| server `FilmsApi` passes the caller's `AbortSignal` to TMDB | the signal is ignored on the server                                                | Loads are shared between requests (in-flight de-duplication), so one closed request must not fail the others. TMDB calls still time out after 5 s.      |
| cache drops "least recently used"                           | drops the oldest inserted                                                          | Simpler, and enough for 500 entries with TTLs.                                                                                                          |
| `resolve-category.ts`                                       | `resolveCategory` and `filmPath` in `categories.ts`                                | They are a few lines and belong with the category list.                                                                                                 |
| `NotFoundPage`                                              | a `*` route that throws 404, rendered by `RouteError`                              | One error page for every 404 (unknown path, unknown film, invalid id), always inside the layout.                                                        |
| `Header` in `components/`                                   | `app/Header/`                                                                      | It reads the wish list, so it is not domain-agnostic.                                                                                                   |
| retry calls `useRevalidator()`                              | a link to `/`                                                                      | Works without JavaScript too.                                                                                                                           |
| redirect after a form post to `request.url`                 | to the path + query only                                                           | An absolute URL would carry the wrong protocol behind a proxy that terminates HTTPS.                                                                    |
| `renderHeadTags`                                            | `serializeHead`                                                                    | Testing Library's lint rules treat every `render…` function as a component render.                                                                      |
| fixtures as `*.json`                                        | `tests/mocks/tmdb/fixtures.ts`, typed with the TMDB DTOs, plus one shared resolver | The compiler checks the fixtures against the DTO types. MSW handlers and the e2e mock server answer from the same resolver, so they cannot drift apart. |
| —                                                           | the film route skips revalidation after form posts (`shouldRevalidate`)            | Film data does not depend on the wish list, so adding a film does not refetch it.                                                                       |
| —                                                           | posters load eagerly only in the first row                                         | React 19 preloads eager images, so eager posters in every row produced many preload links.                                                              |
| SCSS partials `@use '@/styles/…'`                           | relative paths                                                                     | Vite does not apply the tsconfig `@/` alias inside Sass `@use`.                                                                                         |
| —                                                           | coverage thresholds at 80% (lines, statements, functions, branches)                | Set as planned in project-setup §11 once the first features landed. Currently about 97% of lines are covered.                                           |
