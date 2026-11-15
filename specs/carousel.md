# Spec — Arc Carousel

Status: **Implemented** (2026-11-15). Section 12 lists where the implementation differs from this draft, and why.
Covers requirements: FR-HOME-1..3, UI-HOME-2, TECH-LIB-4, TECH-CSS-1..4, TECH-SSR-1, EVAL-1..7 (see [requirements.md](requirements.md)).
Builds on: [data-and-routing.md](data-and-routing.md) (loaders, D5), [project-setup.md](project-setup.md) (§4 import boundaries, §8 styles).

## 1. Goal

Replace the plain scrolling rows on the homepage (`FilmRow`) with an **arc carousel**. The cards fan out along an arc, the active card stands at the top, and moving the carousel sends a "chained spring" wave through the cards.

It must:

- be **hand-written**, with no carousel, animation or UI library (TECH-LIB-4),
- be a **generic component** that knows nothing about films (EVAL-1, EVAL-4, EVAL-5); the homepage uses it three times,
- render on the server in its **final resting state**, so hydration does not move anything (EVAL-7),
- be usable with **arrow buttons, the keyboard, touch and a trackpad**, and with a screen reader,
- **wrap around** at both ends,
- show a **skeleton** while its data loads.

Out of scope: the category themes (fonts, colours); a separate spec covers them. The carousel only exposes the tokens they need (§7).

## 2. Visual reference and what we change

The reference is the "Cue Chained Spring Arc Carousel" from 21st.dev (a React demo with a hand-written spring). We take its look and motion and write our own implementation.

| Reference                                                       | Ours                                                                | Why                                                                                                     |
| --------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Cards on an arc, rotated around a pivot far below               | Same, as CSS custom properties: `rotate(angle) translateY(-radius)` | The look.                                                                                               |
| "Chained spring": each card follows its neighbour               | Same idea, hand-written physics in a pure, tested module            | The motion is the point of the design.                                                                  |
| Big index (`05`) and the name of the active card above the arc  | Index (`05 / 20`), title, year and rating of the active film        | More useful for films.                                                                                  |
| Grey half-circle "arch" behind the cards                        | A token-coloured arch                                               | Dark theme, and the category themes can recolour it.                                                    |
| Card lifts on hover                                             | Same, plus the same lift on keyboard focus                          | Keyboard users get the same feedback.                                                                   |
| Controlled by the **vertical** mouse wheel, on the whole window | **Horizontal** wheel or trackpad swipe, over the carousel only      | There are three carousels on one page; capturing the vertical wheel would stop the page from scrolling. |
| No keyboard, no buttons                                         | Previous / next buttons, the keyboard, touch drag                   | Requirement; accessibility.                                                                             |
| Stops at the first and last card                                | **Wraps around**                                                    | Requirement.                                                                                            |
| Intro animation: cards slide up, then fan out                   | **No intro** on the first load                                      | The server already sends the fanned-out arc; an intro would move content that is already on screen.     |
| Full-viewport, fixed size                                       | Full width, fixed height per breakpoint, three stacked on the page  | UI-HOME-2.                                                                                              |

## 3. Decisions

| #   | Decision           | Choice                                                                                                                                                                                                                |
| --- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Visible cards      | **7 on desktop** (active ± 3), **5 on tablets** (± 2), **3 on phones** (± 1). Set with CSS custom properties per breakpoint; JS reads them, so the numbers live in one place.                                         |
| C2  | Ends               | **Wrap around.** Positions are circular: card `i` sits at the shortest signed distance from the active card, modulo the number of cards.                                                                              |
| C3  | Autoplay           | **None.**                                                                                                                                                                                                             |
| C4  | Controls           | Previous / next buttons; ← → (and Home / End) when focus is inside the carousel; touch / pen drag; horizontal wheel and trackpad swipe over the carousel.                                                             |
| C5  | Clicking a card    | **Every card is a link to the film page** (FR-HOME-3), including the side cards. Moving the carousel is done with the controls in C4.                                                                                 |
| C6  | Animation          | Hand-written spring physics in a `requestAnimationFrame` loop that runs **only while cards are moving** (§5).                                                                                                         |
| C7  | Reduced motion     | With `prefers-reduced-motion: reduce`, cards jump to their positions, with no springs and no hover lift.                                                                                                              |
| C8  | Without JavaScript | The server renders the arc for the active index from the URL (`/?action=4`). The arrows are **real links** to the neighbouring index. With JavaScript they move the carousel in place and do not change the URL (§6). |
| C9  | Skeleton           | Shown while a category loads **after hydration** (client-side navigation, "Try again"). On the first request the server waits for the data (D5), so the HTML arrives filled in and no skeleton is needed (§8).        |
| C10 | Library            | None. React, CSS and about 150 lines of our own TypeScript.                                                                                                                                                           |

## 4. Geometry

All sizes are tokens on the carousel root, overridden per breakpoint in SCSS:

| Token                   | Phone | Tablet | Desktop | Meaning                                           |
| ----------------------- | ----- | ------ | ------- | ------------------------------------------------- |
| `--carousel-card-width` | 9rem  | 11rem  | 13rem   | poster width (2:3, so the height follows)         |
| `--carousel-radius`     | 34rem | 48rem  | 60rem   | distance from the pivot to the card centre        |
| `--carousel-gap-angle`  | 15deg | 13deg  | 12deg   | angle between neighbouring cards                  |
| `--carousel-side-count` | 1     | 2      | 3       | visible cards on each side of the active one (C1) |

- Each card gets `--offset` (its signed circular distance from the active card) and is placed with `transform: rotate(calc(var(--offset) * var(--carousel-gap-angle))) translateY(calc(-1 * var(--carousel-radius)))`. **The server renders the same transforms**, so the static HTML already shows the arc.
- Cards with `|offset| > side-count` are moved one step further out and made invisible (`opacity: 0`, `visibility: hidden`). They stay in the DOM but are `inert`, so they are skipped by keyboard and screen readers.
- The stage has a fixed height per breakpoint and `overflow: clip` horizontally, with room above the active card for the hover lift. The page never scrolls sideways.
- `z-index` falls off with `|offset|`, so the active card is on top.

## 5. Motion: chained spring

Pure module `src/components/Carousel/spring.ts` (no DOM), unit-tested:

```ts
interface CardMotion {
  angle: number;
  velocity: number;
}
/** One frame of the chain; returns true when every card has settled. */
function stepChain(
  cards: CardMotion[],
  targets: number[],
  order: number[],
  config: SpringConfig,
): boolean;
```

- **Targets:** `offset × gapAngle` for every card (`offset` from `circularOffset()`, C2).
- **Chain:** cards are updated in `order`, from the edge the carousel moves _towards_. The first card in the order springs to its own target. Every next card springs to `previous card's angle ∓ gapAngle`. This produces the wave of the reference. The defaults are `stiffness = 0.2` and `damping = 0.4`, tuned by eye.
- **Wrapping without sweeping:** when a card's offset jumps by more than half the number of cards (it wraps from one end to the other), its angle is **teleported** to just outside the visible edge it enters from, instead of sweeping across the whole arc. It is invisible there (§4), so the jump cannot be seen.
- **Frame loop:** `useArcMotion(cardRefs, activeIndex)` starts a `requestAnimationFrame` loop when `activeIndex` changes and stops it once every card has settled (|Δangle| and |velocity| < 0.05). It writes `transform` straight to the card elements (refs), not through React state, so a frame does not re-render React. When settled, the inline styles match the CSS `--offset` positions exactly.
- **Reduced motion:** the loop is skipped; React updates `--offset` and the CSS places the cards.

## 6. Controls and state

`activeIndex` is React state inside the carousel. Its initial value comes from a prop, `initialIndex`; the homepage reads it from the URL (C8).

| Input                       | Action                                                 | Notes                                                                                                                                            |
| --------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| "Previous" / "Next" buttons | `activeIndex ∓ 1`, wrapping                            | `<a href="?{param}={index}">` rendered by the server, so they work without JS; after hydration the click is prevented and handled in place (C8). |
| ← / →                       | `∓ 1`                                                  | When focus is anywhere inside the carousel (a card link or a button).                                                                            |
| Home / End                  | first / last card                                      |                                                                                                                                                  |
| Touch / pen drag            | one step per ~⅓ card width dragged, settles on release | Pointer events. `touch-action: pan-y` keeps vertical page scrolling native. A drag longer than 10 px cancels the link click.                     |
| Horizontal wheel / trackpad | `∓ 1` per gesture (deltaX ≥ 30, then a 350 ms lock)    | The vertical wheel is never captured.                                                                                                            |

- After a keyboard move, focus goes to the new active card, so ← → walks the films.
- The URL param name is passed in as a prop (`?action=`, `?comedy=`, `?horror=`). Only the server uses it, so a link to `/?horror=5` opens with that card in front. An invalid or out-of-range value falls back to `0`.

## 7. Markup and accessibility

The structure follows the [WAI-ARIA APG carousel pattern](https://www.w3.org/WAI/ARIA/apg/patterns/carousel/), "tabbed"-free variant:

```html
<section class="carousel" aria-roledescription="carousel" aria-labelledby="category-action">
  <h2 id="category-action">Action</h2>
  <div class="carousel__label" aria-hidden="true">05 / 20 · The Matrix · 1999 · ★ 8.2</div>
  <div class="carousel__stage">
    <div class="carousel__arch"></div>
    <ul class="carousel__track">
      <li
        class="carousel__slide"
        role="group"
        aria-roledescription="slide"
        aria-label="5 of 20"
        style="--offset: 0"
      >
        …card…
      </li>
      …
    </ul>
  </div>
  <div class="carousel__controls">
    <a class="carousel__button carousel__button--prev" href="/?action=3" aria-label="Previous film"
      >…</a
    >
    <a class="carousel__button carousel__button--next" href="/?action=5" aria-label="Next film"
      >…</a
    >
  </div>
  <p class="carousel__status visually-hidden" aria-live="polite">Film 5 of 20: The Matrix</p>
</section>
```

- The live region announces the new active item after button and keyboard moves only. Drags and wheel gestures are frequent, so they do not announce each step.
- Hidden slides (§4) are `inert`.
- The buttons have visible focus styles and a minimum 44 × 44 px hit area.
- **Generic API.** The film details stay outside:

```tsx
<Carousel
  items={films}
  getKey={(film) => film.id}
  getItemLabel={(film) => film.title}          // live region and slide labels
  renderItem={(film, { isActive }) => <FilmCard … />}
  renderActiveLabel={(film) => <FilmLabel film={film} />}
  labelledBy="category-action"
  initialIndex={indexFromUrl}
  indexParam="action"
/>
```

- Theme hooks for the category-themes spec: `--carousel-arch-color`, `--carousel-accent`, and the label font.

## 8. Skeleton

- **Where it shows.** After hydration, the home loader returns **promises** per category instead of awaited data. React Router then switches to the page at once, and each carousel renders `<Suspense fallback={<CarouselSkeleton/>}><Await resolve={row}>…`. Each category fills in on its own as its data arrives.
- **Server.** Unchanged (D5): the loader awaits, so the HTML and the hydration data contain plain values. `<Await>` renders resolved values synchronously, so the server never shows the fallback and hydration matches.
- **One switch.** `RouteDeps` gets `deferData: boolean`: `false` on the server, `true` in the browser. The home loader is the only place that reads it.
- **Errors.** `<Await errorElement>` shows the existing inline error ("Couldn't load action films. Try again"). This replaces the current `Promise.allSettled` rows. The 502 page stays for the case where every category fails on the server.
- **Look.** `CarouselSkeleton` uses the same geometry (§4): the same arch and the same number of visible cards, as plain shimmering placeholders. Swapping it for the real carousel moves nothing. The shimmer stops under `prefers-reduced-motion`.
- **The SSR fallback path** (shell error → `createRoot`) renders the skeleton too, through `hydrateFallbackElement`.

## 9. Files

```
src/components/Carousel/
  Carousel.tsx             generic component (state, controls, markup)
  CarouselSkeleton.tsx     placeholder with the same geometry
  carousel-math.ts         wrapIndex, circularOffset, visible window, parseIndexParam
  spring.ts                stepChain (pure physics)
  use-arc-motion.ts        rAF loop writing transforms to refs
  use-carousel-gestures.ts keyboard, pointer drag, horizontal wheel
  _carousel.scss           geometry tokens, arch, cards, controls, skeleton
  *.test.ts(x)
src/features/films/components/
  FilmCarousel/            Carousel + FilmCard + FilmLabel (title, year, rating)
  FilmRow/                 removed
src/pages/HomePage/        Suspense/Await per category; reads ?action= etc.
```

The import boundary (project-setup §4) keeps `components/Carousel` free of film code. ESLint enforces it.

## 10. Testing

| Level     | What                                                                                                                                                                                                                                                                                         |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit      | `wrapIndex`, `circularOffset` (both directions, wrap, even and odd counts), `parseIndexParam`; `stepChain` converges to its targets, keeps the gap between neighbours while moving, and does not sweep a wrapping card across the arc                                                        |
| Component | Buttons and ← → / Home / End move and wrap; focus follows; the live region text; hidden slides are `inert`; each slide is a link to the film; a drag does not trigger the link; with reduced motion, positions are set without the loop                                                      |
| SSR       | The HTML has the arc transforms (`--offset`) for the `?action=` index, the arrows are links to the neighbouring indexes, and there is no skeleton in the server HTML                                                                                                                         |
| E2E       | With JS: the arrows and the keyboard move the carousel, and the last card wraps to the first. Without JS: the arrow links change the active film, and the cards still open film pages. A client-side navigation to `/` shows skeletons first, then the films. No console errors (hydration). |

Physics timing is not tested frame by frame in jsdom. Component tests use reduced motion, or advance fake timers until the motion settles.

## 11. Acceptance criteria

- [x] Three arc carousels on the homepage, full width, stacked (FR-HOME-1, FR-HOME-2, UI-HOME-2).
- [x] Clicking any card opens its film page in that category (FR-HOME-3).
- [x] Arrows, keyboard, drag and horizontal wheel move the carousel, which wraps at both ends; there is no autoplay.
- [x] The chained-spring wave plays when moving; reduced motion turns it off.
- [x] The server HTML shows the arc; hydration moves nothing and logs no warnings.
- [x] Without JS, the arrows work as links, and the cards still open film pages.
- [x] A skeleton shows while a category loads after hydration.
- [x] No new dependencies; `npm run check` passes.

## 12. Changes from the draft

| Draft                                                     | Implemented                                                                                                          | Why                                                                                                                                                                            |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| arrows are links whose click is prevented after hydration | links before hydration, **real `<button>`s after it** (`useSyncExternalStore` hydration flag)                        | With JavaScript the arrows do not navigate, so they should be announced as buttons. The swap happens after hydration, so there is no mismatch.                                 |
| every row goes through `<Suspense>` + `<Await>`           | only rows whose films are still a **promise**; loaded rows render the carousel directly                              | `<Await>` suspends for a moment even with ready data. On the server that put the skeleton into the streamed shell, with the carousel swapped in by a script. A test caught it. |
| the skeleton also renders on the SSR fallback path        | not done (`hydrateFallbackElement` stays `null`)                                                                     | The fallback belongs to the root route, which serves every page; a carousel skeleton would be wrong on a film page. It is a rare failure path.                                 |
| geometry tokens: 15 / 13 / 12 deg, drop not specified     | 14 / 13 / 11 deg, drop 2 / 4.5 / 7 rem                                                                               | Tuned by eye in the browser: less overlap between neighbouring cards, while the outer cards still sink into the bottom edge like in the reference.                             |
| touch / pen drag                                          | touch / pen only; mouse drags are ignored                                                                            | With a mouse, dragging fights text selection and native image dragging; the mouse has the buttons and the wheel.                                                               |
| —                                                         | before hydration, `inert` assumes the desktop layout (3 cards per side)                                              | The server does not know the screen size. On phones without JavaScript, the cards hidden by CSS stay focusable; after hydration the real count is read from CSS.               |
| —                                                         | `.visually-hidden` utility class (`styles/base/_utilities.scss`); ESLint treats `expect*` test helpers as assertions | Needed by the live region and the poster-only card titles; the lint rule change lets tests use small assertion helpers.                                                        |
