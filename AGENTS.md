# AGENTS.md — Vitae harness

This repo is **AI-developed**. `AGENTS.md` is the operating manual.
Read it before changing code. Prefer this file over chat memory or `README.md`.

## North star

Vitae is a calm, mobile-first PWA for Plutarch’s *Parallel Lives* (Dryden/Clough, Gutenberg #674).
Readers move **pair-grouped, link-direct**: Library lists pairs with direct links to each Life/Comparison (no intermediate pair page).
Reading is **CSS-column pages only** (swipe like a book) — no scroll layout.
The product should feel like a quiet book, not a dashboard.

**Kindle note:** Fire tablets (Silk) are supported with legacy build + touch/column fallbacks. The e-ink **Experimental Browser** is too old for React/modern JS — we show a calm boot message instead of a blank crash (`src/lib/kindleCompat.ts`).

## Stack

- Vite 8 + React 19 + TypeScript + React Router
- PWA via `vite-plugin-pwa` (offline index + runtime-cached work JSON)
- Content ingest: Node ESM scripts + `linkedom`
- Lint: `oxlint`
- Tests: Node built-in test runner (`node --test`) with `--experimental-strip-types`

No backend. No database. Prefs live in `localStorage`.

## Canonical commands

```bash
npm install
npm run content          # EPUB extract → public/data (needs content/source/epub-extract)
npm test                 # unit/corpus tests
npm run smoke            # validate public/data integrity
npm run lint
npm run typecheck
npm run check            # test + lint + typecheck  ← run after every change
npm run verify           # check + smoke            ← Definition of Done gate
npm run dev -- --host 127.0.0.1 --port 5175
npm run build            # typecheck + vite (uses committed public/data)
npm run build:content    # regenerate corpus then build
```

GitHub Pages: push to `main` runs `.github/workflows/deploy-pages.yml` with `VITE_BASE=/vitaereader/`.

Optional live smoke against a running dev server:

```bash
VITAE_BASE_URL=http://127.0.0.1:5175 npm run smoke
```

**Do not invent alternate scripts.** Extend these if needed.

## Agent loop (required)

For every non-trivial task:

1. **Orient** — read this file + the ownership map; `rg` before broad reads.
2. **Change the smallest surface** that satisfies the request.
3. **Put logic in the right layer** (see Ownership).
4. **`npm run check`** — must pass.
5. **`npm run smoke`** if content/catalog/data shape could have changed.
6. **Browser-verify reader changes** (below). Pagination/chrome bugs are visual.
7. **Self-review** against Invariants before reporting done.

If `check` fails, fix it. Do not skip hooks or weaken tests to greenwash.

## Ownership map

| Path | Owns |
|------|------|
| `src/pages/` | Route screens: Library, Highlights, Reader shell |
| `src/components/` | Reusable UI (PaginatedReader, SettingsSheet, ShareSheet, CharacterSheet, LocationSheet, SelectionToolbar, …) |
| `src/lib/readingPrefs.ts` | Kindle-like Aa prefs (font/size/leading/margins) + layout key |
| `src/lib/prefs.ts` | Theme, progress, finished, highlights |
| `src/lib/libraryOrder.ts` | Library pair/unpaired sequence + work order for Highlights |
| `src/lib/highlightsList.ts` | Flatten / sort / group highlights for the Highlights page |
| `src/lib/paginationLayout.ts` | Floored page width + CSS column sizing |
| `src/lib/tapZones.ts` | Kindle-like L/C/R tap thirds over the page clip (gutters inherit) |
| `src/lib/pageGestureIntent.ts` | Page-swipe vs text-select intent (slop / axis lock) |
| `src/lib/kindleCompat.ts` | Legacy Kindle/Silk detection + ResizeObserver/transform helpers |
| `src/lib/contentProgress.ts` | Word-fraction progress + page restore from anchors |
| `src/lib/charMatch.ts` | Character/location name longest-match + ambiguous-name resolutions + text segmentation |
| `src/lib/geoMap.ts` | Equirectangular projection + SVG path helpers for offline location maps |
| `src/lib/journeyMap.ts` | Location presence (named vs visited) + visit kinds + journey path/bounds helpers |
| `src/lib/campaignLand.ts` | Natural Earth 10m land rings (public domain, simplified) for campaign maps |
| `scripts/build-campaign-land.mjs` | Regenerate `campaignLand.ts` from NE land GeoJSON |
| `src/lib/textRanges.ts` | Highlight range helpers + compose with char/loc refs |
| `src/lib/selectionOffsets.ts` | DOM selection → paragraph plain-text offsets |
| `src/lib/shareQuote.ts` | Share citation text + X/Threads intents + copy quote/image orchestration |
| `src/lib/selectionLink.ts` | Compact base64url encode/decode for share selection ranges (`?r=`) |
| `src/lib/quoteCard.ts` | Client canvas quote-card PNG (layout helpers + render) |
| `src/content/types.ts` | Shared Work/Paragraph types |
| `src/index.css` | Design tokens + themes (**colors only**) |
| `scripts/parse-epub.mjs` | EPUB → JSON ingest |
| `scripts/pair-catalog.mjs` | Pair structure / culture derivation |
| `scripts/text.mjs` | Slugify, titles, word count, classify |
| `scripts/*.test.mjs` | Unit + catalog tests |
| `scripts/smoke.mjs` | Committed data integrity |
| `content/source/` | Gutenberg EPUB (+ gitignored extract) |
| `public/data/` | Served corpus (`index.json`, `works/*.json`) — committed |
| `public/data/annotations/` | Optional per-work character + location highlights (`<workId>.json`) |

**Rule:** domain math (ETA, page count, locations, progress mapping) lives in `src/lib/reading.ts` and is unit-tested. Do not bury it in JSX.

## Routes

| Path | Screen |
|------|--------|
| `/` | Library (chronological pairs + unpaired; each life/comparison is a direct link) |
| `/highlights` | All user highlights (Recent / By book); deep-links to `/read/:slug?p=` |
| `/pair/:slug` | Redirects to `/` (legacy) |
| `/read/:slug` | Reader (life or comparison) |

## Reader invariants (do not break)

These are load-bearing. Violating them recreates fixed bugs.

1. **Shared chrome bands** — Reserved top/bottom empty spacers; chrome *overlays* those bands. Showing/hiding chrome must never resize the reading surface.
2. **Themes = colors only** — `[data-theme]` may override color tokens (`--bg`, `--ink`, `--accent`, `--highlight`, `--link-underline`, `--char-underline`, `--loc-underline`, …). Never change `--leading`, `--font-size-body`, `--font-optical`, or spacing via theme.
3. **Type prefs remasure pages** — Font / size / leading / margins live in `vitae.reading` → `data-type-*` on `<html>` (see `src/lib/readingPrefs.ts`). Changing them **must** remasure columns and restore via content-anchored ratio (`layoutKey` on `PaginatedReader`) — never keep a stale page index. Per-font `--font-optical` keeps Georgia / Literary / Classic at a matched apparent size on `.paged-content`.
4. **Pages = CSS columns + hard clip** — `.paged-clip` is `overflow: hidden; contain: paint`. Content `width` **and** `columnWidth` must be the same integer page width. Do not use `width: auto` on the column box.
5. **Measure with floored integers** — subpixel widths cause column bleed.
6. **Footer stats are overlays** — page position and ETA always render in the bottom chrome when open; they must not change spacer height.
7. **Position metrics** — Footer shows `page / pageCount` (+ shared ETA). Kindle-style location math stays in `src/lib/reading.ts` for library progress and tests.
8. **Single content-anchored progress (Kindle-like)** — One `vitae.progress[workId]` float (0–1) = fraction of **words through the work** (cf. Kindle locations: a place in the text, not the viewport). Measure and restore **center-anchored** at the center of `.paged-clip` (`measureContentRatio`). **Pages restore** must resolve that anchor to the column/page that contains it (`pageIndexForContentRatio`), not `ratio × pageCount`.
9. **Missing Comparisons** (e.g. Alexander–Caesar) are manuscript losses — UI may note absence; do not “invent” comparison text.
10. **No monolith corpus in `public/`** — index + per-work JSON only (PWA caches accordingly).

## Content pipeline

```
content/source/pg674.epub
  → unzip to content/source/epub-extract/   (gitignored)
  → npm run content  (scripts/parse-epub.mjs + pair-catalog.mjs)
  → public/data/index.json
  → public/data/works/<slug>.json
```

Optional character / location highlights (hand-authored, not from EPUB):

```
public/data/annotations/<workId>.json
  {
    workId, subject,
    characters: [{ id, names[], blurb, relation, links? }],
    locations?: [{
      id, names[], blurb, relation, lat, lon, modern?,
      presence?: "named"|"visited",
      visitKind?: "city"|"battle"|"crossing"|"oracle"|"camp"|"foundation",
      visitOrder?: number,
      travel?: "land"|"sea"
    }],
    nameResolutions?: [{ paraId, start, end, characterId, note? }]
  }
```

**Annotated lives (14):** Alcibiades, Alexander, Caesar, Camillus, Coriolanus, Fabius, Lycurgus, Numa Pompilius, Pericles, Poplicola, Romulus, Solon, Themistocles, Theseus. Other works have no cast file yet (reader simply skips highlights).

`names` are surface forms to match in paragraph text and in sheet blurbs (longer first). In character sheets, other cast names inside the blurb are tappable (same-work profile hop + Back). In location sheets, other place names in the blurb hop the same way; an expandable offline SVG map (Natural Earth 10m land silhouette, public domain — no tiles/API keys) pins `lat`/`lon` (and peer dots when widened). **Presence** tags why a place is highlighted: `named` (default) = mentioned in the narrative; `visited` = the protagonist was there. Visited places need `visitOrder` (chronological) and optional `visitKind` (icon: city gate, crossed swords, waves, oracle flame, tent, foundation star). Optional `travel` marks the inbound leg: `land` (solid path) or `sea` (dotted boat leg). On the expanded map, visited stops connect as a journey line with those icons (solid land / dotted sea); named-only peers stay muted dots. Collapsed map zooms in on the focused place; expanded frames the journey **so far** tightly to the path (per-axis padding; peer dots only inside that frame), in a larger map frame. In the reader, named places keep a dashed underline; visited places use a solid underline. Optional character `links` are validated by smoke but unused in UI. Missing annotation files → no highlights (safe corpus-wide). Location arrays are optional per work (**Alexander**, **Caesar**, **Theseus**, and **Romulus** ship journey data first).

When several cast members share a surface form (e.g. multiple Philips), body links are **not** guessed from the name alone. Add optional `nameResolutions`:

```
nameResolutions: [{ paraId, start, end, characterId, note? }]
```

Each entry is an LLM/reviewer decision for one span (read surrounding paragraphs; score who is meant). Unique longer forms still match without a resolution. Unresolved ambiguous spans stay plain text. Sheet blurbs fall back to the first cast member that owns the name.

Expected shape (asserted by tests/smoke): **68 works, 22 pairs, 4 unpaired, ~740k words**. Per-work character annotations stay modest (smoke caps at **100** cast members); prefer people who appear in the text over encyclopedic completeness.

Regenerate only when ingest/catalog/parser changes. Commit updated `public/data` with those changes.

## Prefs (`localStorage`)

| Key | Values |
|-----|--------|
| `vitae.theme` | `day` \| `night` \| `sepia` \| `eink` (colors only) |
| `vitae.reading` | `{ font, size, leading, margin }` type metrics — see `src/lib/readingPrefs.ts`. Applied via `data-type-*` on `<html>` for the **reader surface** (`.paged-content`); Library pins its own catalog type and must not inherit Aa shout. |
| `vitae.progress` | `{ [workId]: 0..1 }` content word-fraction (see Invariant 8) |
| `vitae.finished` | `string[]` |
| `vitae.highlights` | `{ [workId]: Array<{ id, paraId, start, end, text, createdAt }> }` plain-text offsets (same space as charMatch). Listed on `/highlights`; tap a `.text-highlight` in the reader to Remove via SelectionToolbar. |

API: `src/lib/prefs.ts` (theme/progress/highlights) + `src/lib/readingPrefs.ts` (Aa sheet). Keep storage keys stable unless migrating.

Reader deep links: `/read/<slug>?p=<paraId>` or `#para-<paraId>` resume at that paragraph (content ratio at para start). Share selection links add `&r=<base64url>` (compact binary token of one or more `{paraId,start,end}` ranges from `selectionLink.ts`). On load, `r` is decoded and each range is **ensured** as a highlight in `vitae.highlights` (exact-range dedupe); reading still resumes via `p` (or the first range’s para). Citation / X / Threads / quote-card footer use the live `readerBaseUrl()` deep link (current origin + Vite base — GH Pages or local).

## Browser verification (reader / UI)

Automated unit tests cannot catch column bleed or chrome layout. For reader work:

```bash
npm run dev -- --host 127.0.0.1 --port 5175
# then drive with playwright-cli (or Cursor browser tools)
```

Minimum path:

1. `/` — library loads; totals visible.
2. `/` — pair rows are name links only (Theseus · Romulus · Comparison); unread underlined, mid-read progressive strikethrough after ~1 page, finished fully struck + dull.
3. `/read/theseus` — top+bottom spacers exist; footer shows `N / M` when bottom chrome open.
4. Open settings via stable hooks: `[data-testid="reader-show-menu"]` then `[data-testid="reader-settings"]`. Playwright click by label often fails while chrome is `translateY(-110%)` off-screen — reveal first, or open via eval below.
5. `.paged-content` style `width === columnWidth` (integers); footer `N / M`; no adjacent-column bleed.
6. Toggle themes — page breaks must not jump.
7. End of work shows Mark as read / Marked finished; spacer heights unchanged when bottom chrome toggles.

### Agent UI hooks

| testid | Purpose |
|--------|---------|
| `reader-show-menu` | Reveal top+bottom chrome (tap an open bar again to hide both) |
| `reader-show-position` | Reveal top+bottom chrome (tap an open bar again to hide both) |
| `reader-settings` | Open settings sheet (also forces top chrome open) |

```js
// Reliable settings open (works even if gear is off-screen)
document.querySelector('[data-testid="reader-show-menu"]')?.click()
document.querySelector('[data-testid="reader-settings"]')?.click()
// or force chrome classes:
document.querySelector('.reader-shell')?.classList.add('top-open', 'bottom-open')
```

### Quick DOM probes

```js
(() => ({
  shell: document.querySelector('.reader-shell')?.className,
  top: !!document.querySelector('.reader-top-spacer'),
  bottom: !!document.querySelector('.reader-bottom-spacer'),
  pos: document.querySelector('.reader-bottom-pos')?.textContent,
  w: document.querySelector('.paged-content')?.style.width,
  cw: document.querySelector('.paged-content')?.style.columnWidth,
}))()
```

## Testing strategy

| Layer | Where | What |
|-------|-------|------|
| Pure math / catalog | `scripts/text.test.mjs` importing `src/lib/*.ts` | ETA, pages, locations, slugify, pair catalog |
| Data integrity | `scripts/smoke.mjs` | index ↔ work files ↔ catalog |
| Types | `tsc -b` | no emit errors |
| Lint | `oxlint` | static issues |
| Visual/reader | manual / playwright-cli | chrome, columns, themes |

Add unit tests when changing `src/lib/reading.ts`, ingest, or catalog.
Do not add heavy React Testing Library stacks unless explicitly requested — keep the harness thin.

## Design constraints

- Calm reading UI: measure ~`34rem`, serif display/body (see `src/index.css`).
- Mobile-first; respect safe areas.
- Avoid dashboard chrome, card grids in the reader, and novelty UI.
- PWA: cache `data/index.json` precache + runtime CacheFirst for `/data/works/*.json` and `/data/annotations/*.json` (200 only).

## Coding norms

- Match existing style; small diffs; no drive-by refactors.
- Prefer deletion and clearer names over new abstractions.
- Extract hooks/helpers only when they remove real duplication or clarify ownership.
- Keep gameplay/domain math out of CSS/JSX when it can be pure.
- No new markdown docs unless asked — update **this** file instead.
- Never commit secrets. Never force-push `main`. Commit only when asked.

## What not to do

- Do not reintroduce a Scroll layout mode or dual layout prefs.
- Do not change pagination to vertical windowing / absolute line clipping.
- Do not let themes alter line-height or font-size.
- Do not reintroduce a single `corpus.json` blob in `public/`.
- Do not resize layout when opening settings/chrome/footer.
- Do not skip `npm run check` after code changes.
- Do not “fix” missing Comparisons by generating text.

## Definition of done

A change is done when:

1. `npm run verify` passes (or `check` + `smoke` if verify unavailable).
2. Reader/UI changes were browser-probed against Invariants.
3. New pure logic has a focused test.
4. `AGENTS.md` updated if you changed commands, invariants, or ownership.
5. Report: what changed, what ran, residual risk.

## Fresh session bootstrap

```bash
npm install
npm run verify
npm run dev -- --host 127.0.0.1 --port 5175
```

If `public/data` is missing/stale and EPUB extract exists:

```bash
unzip -o content/source/pg674.epub -d content/source/epub-extract
npm run content
npm run smoke
```
