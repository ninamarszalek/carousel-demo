# Spec — Visual Design and Category Themes

Status: **Implemented** (2026-11-15). The first version (full-width gradient bands) was replaced after review by the design below; section 5 lists what changed and why.
Covers requirements: FR-CAT-1..3, UI-HOME-2, UI-DET-1..4, TECH-CSS-1..4, EVAL-2, EVAL-3 (see [requirements.md](requirements.md)).
Builds on: [carousel.md](carousel.md), [project-setup.md](project-setup.md) §8 (styles).

## 1. Direction

A light, gallery-like interface. The page is **white**, and colour comes only as **light**:

- **Pinned header.** The header stays at the top: white, slightly translucent (frosted), with a soft shadow, in the manner of Apple's apps.
- **One screen per category.** Each homepage category is a panel exactly one screen high under the header. Its carousel is **docked to the bottom**: the cards rise from the bottom edge, the side cards dip below it, and the caption (category, index, title) sits above.
- **Glow, not fill.** Behind the panels, one fixed layer of soft, half-transparent light rises from the bottom of the screen in the colours of the category on screen.
- **Smooth transitions.**
  - Scrolling **snaps** from one category to the next, so a genre is never left cut in half.
  - The glow's colours flow from one category's palette to the next.
  - The next panel rises into place from slightly lower and fainter.
  - Sliding a carousel moves the glow to the next step of its palette.
- **The film page** has the same glow behind the image and the description.

## 2. Category themes

| Category       | Glow palette (4 steps)                          | Accent (arrows, index, button) | Display font (FR-CAT-1)               | Button (FR-CAT-2)                                 |
| -------------- | ----------------------------------------------- | ------------------------------ | ------------------------------------- | ------------------------------------------------- |
| Action         | fire: orange → red → amber → flame (no pink)    | flame red                      | **Oswald**, condensed, uppercase      | slanted parallelogram, solid, uppercase           |
| Comedy         | sunshine: yellow → turquoise → lemon → sky blue | hot pink                       | **Fredoka**, rounded                  | pill, solid; hover tilts and grows a little       |
| Horror         | night: violet → indigo → blood → deep purple    | blood red                      | **Cinzel**, engraved serif, uppercase | outlined in red, spaced capitals; hover glows red |
| none (default) | mist blue → lilac → pale teal → sky             | ink                            | Inter (the UI font)                   | rounded rectangle, solid ink                      |

FR-CAT-3 ("any other differentiation"): the glow, the accent on the carousel arrows and index, and the category name in the display font.

The fonts are self-hosted from `@fontsource` packages, bundled and hashed by Vite. The CSP stays `'self'`, and nothing loads from a third party at runtime.

## 3. How it is built

- **Tokens.** `src/styles/themes/_categories.scss` holds one Sass map per category and generates `[data-category="…"]` rules that set **custom properties only** (`--theme-*`, `--wishlist-button-*`, the glow colours and positions). The default theme is set on `:root`, and any element with `data-category` (a homepage panel, the glow, a film page) overrides it for its subtree. Components never branch on the category.
- **Glow.** The `category-glow` mixin paints three radial blobs near the bottom edge, from `--gradient-1…3` (colours, at 55–65 % opacity) and `--blob-1…3-x/y` (positions). These properties are **registered with `@property`** (`<color>`, `<percentage>`), so `transition` interpolates them. Plain custom properties would jump.
- **Steps.** `[data-category][data-gradient-step="0…3"]` picks palette colours `s, s+1, s+2` and one of four blob layouts. `GRADIENT_STEPS` in `categories.ts` must match `$gradient-steps`.
- **Homepage.** `HomePage` keeps each carousel's active index (from `onActiveIndexChange`) and finds the panel on screen with an `IntersectionObserver` (`useMostVisible`). The fixed glow gets that category and `activeIndex mod 4`. Panels get `data-state="active|inactive"` for the rise-in transition. Before measuring (on the server, during hydration, and without JavaScript) there is no `data-state`, so every panel shows normally, and the glow uses the first category and its URL index, so the HTML matches on both sides.
- **Snapping.** `:root:has(.home-page)` gets `scroll-snap-type: y mandatory` with `scroll-padding-top` equal to the header height. Panels get `scroll-snap-align: start; scroll-snap-stop: always`. It applies only on screens at least 35 rem tall, so short screens scroll freely. Panels use `overflow: clip`, so a waiting neighbour never shows inside the current one.
- **Docked, viewport-sized carousel.** The stage is exactly as tall as the arc, and the title, caption and stage are pushed to the bottom of the panel, so the caption always sits close above the cards and any spare height goes above the title. The card width is the biggest that fits: `min(78vw, (100svh - 19rem) / 1.5)`, i.e. the screen height minus the header, caption and margins, divided by the poster ratio, clamped per breakpoint. Panels are one screen high on landscape screens only. The active card stands right on the stage's bottom edge, so it fades out all the way down. The radius scales with the card width, so the arc keeps its shape. The bottom of the stage fades out with a `mask-image` over 45 % of a card's height, so the cards dissolve into the glow instead of being cut off by the edge. The panel rise-in (0.45 s) and the glow change (0.55 s) are kept short.
- **Full width.** `.app__main` has no max width and no padding. Pages put text content in a `.container`.
- **Header.** `position: sticky`, a white background at 85 % opacity with `backdrop-filter: blur`, and a hairline plus a soft shadow. The carousel root gets `isolation: isolate`, so its slides never cover the header.
- **Reduced motion.** The global reset shortens transitions, so the glow and the panels change without visible animation.

- **Portrait screens (phones, tablets).** The width limits the cards there, so a panel is as tall as its content, with a white gap (3 rem) before the next genre. The fixed page glow is hidden. Instead, each panel has its own glow (`home-page__panel-glow`), centred behind the lower half of its cards (`category-glow(65%)`) and masked out at the top and bottom, so it never reaches the next genre. The rise-in effect (inactive panels lower and fainter) is used on landscape screens only, because on portrait screens several panels are visible at once.

## 4. Testing

- **SSR:** the glow has the first category and the step of its URL index; each panel has its `data-category`.
- **Component:** moving the carousel moves the glow's `data-gradient-step`; `onActiveIndexChange` fires on every move.
- **E2E:** the glow's computed `--gradient-1` changes after "Next film". Scrolling to Horror switches the glow to `horror` and marks the panels active or inactive. No console errors.

## 5. Changes from the first version

| First version                                                                            | Now                                                                                       | Why                                                                                                                               |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| full-width saturated gradient bands, light text on them                                  | white page, a soft glow from the bottom edge, dark text                                   | Review: the gradients should only be a glow; the page stays white.                                                                |
| bands of content height, stacked with white gaps                                         | screen-high panels with the carousel docked to the bottom, scroll snapping                | Review: the carousel should always appear as a panel docked to the bottom; bands were cut off by the screen edge while scrolling. |
| one gradient per band                                                                    | one fixed glow that follows the category on screen                                        | Lets the colours flow from one category to the next while scrolling.                                                              |
| fixed card sizes per breakpoint                                                          | card size from the viewport height                                                        | Review: a bigger carousel that fills the panel on any screen.                                                                     |
| "Browse films" heading and lead text above the carousels                                 | the heading is visually hidden                                                            | The first panel starts right under the header, and the heading would cost a whole screen of snapping.                             |
| default theme on a `.category-band` class                                                | default theme on `:root`                                                                  | On the film page `data-category` is on the `<article>` and the glow on a child; a class on the child hid the category theme.      |
| one generic "on the list" outline                                                        | pressed colours per theme                                                                 | The horror button would have had white text on white.                                                                             |
| warm palettes for action and comedy, red-violet for horror                               | one family of hues per category: fire, sunshine, night                                    | Review: the glows looked alike; each category now owns a distinct part of the colour wheel.                                       |
| the stage grows to fill the panel, cards sized as a share of the screen height           | a fixed-height stage docked with the caption at the bottom; cards sized to the space left | Review: on phones and smaller screens the gap between the title and the cards was far too big.                                    |
| on phones: content-height panels under the fixed page glow, next panel faded and lowered | on phones: each panel has its own glow; neighbours are shown normally, with a white gap   | Review: on mobile the page glow sat behind the next genre, and the faded next genre showed through it.                            |
| a faint arch disc behind the cards                                                       | removed                                                                                   | Review: on narrow screens its edge showed as an odd trapezoid; on a white page it added nothing.                                  |
| the active card 2–4 rem above the stage edge                                             | on the edge (`--carousel-drop: 0rem`)                                                     | The empty strip under it formed a light trapezoid between the side cards.                                                         |
