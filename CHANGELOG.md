# Changelog

## The grid, the card and the pool from Genframe (2026-10-21)

- `MediaGrid`, `MediaCard`, the video pool and the masonry math moved to the Genframe Kit, the
  component kit for AI image and video tools, and the feed installs them back from its registry with
  `shadcn add` (`components.json`), in place of its copies. Same layout, same previews, same first
  screen placed by CSS before any JavaScript.
- `components/feed/feed-cards.tsx` gives the Kit's cards the feed's names, URLs and badges; the
  page's pool is the Kit's `VideoPoolProvider`; the detail view decodes ThumbHashes with the Kit's
  hook.
- shadcn's color names map onto the feed's tokens; `lib/utils.ts` has a four-line `cn`.
- New: a clip previews while its card has keyboard focus, and the page's `scroll-padding-top`
  keeps cards reached with Tab, or brought back after the detail view, below the header.
- Measured: first-load JS 158.9 → 161.0 KB (budget 172.3), the HTML of `/` +0.9 KB gzip
  (`docs/PERF.md`).

## For the Timeline · Open in Timeline (2026-10-19)

- A story clip's detail view links to the Timeline's robot story
  (`https://storyboard-timeline.vercel.app/?demo=story`), as a bordered button under the facts.
  Other items have none.

## For the Timeline · CORS on `/api/media` (2026-10-18)

- `/api/media` sends `Access-Control-Allow-Origin: *`, so the Timeline (project 2) can load the
  story's clips from the browser. The cache headers are unchanged.

## M5 · Real AI media (2026-10-17)

- 998 images and 99 five-second clips made with Higgsfield's API (Soul 2, Grok Imagine 2.0,
  Kling 2.5, Cinema Studio 4.0) in eight collections, for about $37: `pnpm media:plan`,
  `media:generate` (resumable log, idempotency keys, a spending cap per run), `media:sheet`.
- Fake lettering found with Apple's Vision text recognition and redone; subjects that kept
  drawing text reworded; three items left out.
- `pnpm media:sources` and ingest: originals on R2 (images as WebP), the optional collection
  fields in the manifest, `sourceId` for each clip. Production shows the real media; the
  tests keep the synthetic set (`FEED_MEDIA=synthetic`).
- Collection filter: `?collection=` in the URL and on `/api/media`, a select in the header,
  and on phones a Filters button that opens both selects in a sheet. The one-row desktop
  header starts at 1280 px.
- CI deploys the prebuilt output as one archive (Vercel's 15,000-file limit).
- Measured: first-load JS 157.2 KB (budget 172.3); HTML of `/` 34.4 KB gzip; Lighthouse lab
  LCP 3.04 → 3.34 s locally with real images (`docs/PERF.md`).

## M4 · Detail view, filters and states (2026-10-16)

- Detail overlay: a click zooms the card's media into a native `<dialog>` (View Transitions),
  the address becomes `/m/<id>`, ← → browse the current filtered order (loading more pages
  when needed), Esc, Close and Back close it, and focus returns to the card you ended on.
  Ctrl/Cmd/middle clicks still open a new tab. Its code loads when the page is idle (3.1 KB).
- `/m/[id]`: 340 prerendered pages with title, description and the 1200 px link-preview
  image; work without JavaScript; ← → Esc keys; unknown ids answer 404.
- Filter bar: All / Images / Videos, model, search (200 ms debounce, clear button), result
  count; desktop, tablet and phone layouts from the Header board. Filters live in the URL,
  change it in place and keep old results until new ones arrive.
- States: loading skeletons per lane, no results with Clear filters, inline page error with
  Retry, poster retry button, offline banner.
- Tests: unit and component tests for the detail helpers, URL store, header, states, grid
  and feed; e2e tests 5–12 (detail view, direct visit, filters, empty state, offline, phone,
  axe).
- Measured: first-load JS 153.4 KB (budget 172.3); CLS 0; throttled LCP 0.99 → 0.90 s;
  Lighthouse LCP 3.17 → 3.26 s (details in `docs/PERF.md`). The phone LCP pick now counts the
  taller header.

## M3 · Video pool (2026-10-16)

- `lib/video-pool.ts`: at most 6 `<video>` elements (2 on touch screens or with ≤ 4 GB of
  memory), lent to cards and given back; warm re-hover; least-recently-used stealing that
  frees the decoder; pauses when the tab is hidden. 18 unit tests, one per rule.
- Previews swap in over the poster only once their first frame is painted.
- Touch: the video card nearest the center plays when scrolling stops. Reduced motion and
  Save-Data: play buttons, no autoplay (Save-Data also loads smaller posters). A refused
  `play()` falls back to the play button.
- `?perf=1` overlay: videos in use and steals, cards in the DOM, FPS, live LCP/CLS/INP,
  hover → first frame. Loaded only on demand.
- e2e: 30 fast hovers never create more than 6 videos; hover plays within 1.5 s; reduced
  motion shows play buttons and autoplays nothing.
- Bench (live, r2.dev): max videos 7 → 5, hover → first frame p50 132 → 298 ms (spec's
  expected trade-off), bytes 2.3 → 7.2 MB for 50 hovers (whole previews now download).
  First-load JS 148.6 KB.
- The naive preview is removed (kept in the `v0.2-naive` tag).

## M2 · Grid v1 and a naive baseline (2026-10-16, tag `v0.2-naive`)

- `/api/media?cursor&limit&kind&model&q`: pages of 40, a time + id cursor that never skips or
  repeats, invalid params ignored, CDN cache headers.
- `lib/layout.ts`: lanes (2/3/4/5) and gaps by grid width, card heights clamped to 1:2…2:1.
- `MediaGrid` + `MediaCard`: virtualized masonry (TanStack Virtual, lanes, exact sizes,
  `ResizeObserver`), `<picture>` AVIF/WebP posters, ThumbHash blur, the design's badges and
  focus ring, and the screen-reader name "prompt. Video, 5 seconds, model, AI-generated."
- `/` is static: the first page is in the HTML, the first poster is preloaded with high
  priority, the first row loads eagerly, and the media origin is preconnected.
- Naive video previews on purpose: one `<video preload="metadata">` per mounted video card,
  playing after the pointer rests 100 ms.
- Infinite pages (TanStack Query), loaded 20 cards before the end.
- Tests: unit tests for filters, paging, layout, the API route and MediaCard; e2e tests for
  console errors and layout shift, and for 1,000 items with at most 150 cards in the DOM.
- `pnpm bench`: max videos, heap, hover → first frame, bytes. Baseline in `docs/PERF.md`.
- Measured: first-load JS 155.2 KB (budget 172.3), mobile CLS 0.000, TBT 23 ms, but LCP 4.28 s
  over the 2.5 s target: cards wait for hydration (spec 4.5's fallback is the fix).

### Follow-up: server-rendered first screen (2026-10-16)

- The first page is server-rendered and placed in CSS (`cqw` + container queries), pixel-identical
  to the client layout at any width (e2e-tested at 4 widths, with and without JavaScript). The
  feed works without JavaScript.
- Masonry placement by aspect ratio (`placeCards`), the same at every width; own virtualization
  replaces TanStack Virtual (first-load JS 146.5 KB, −8.7 KB).
- The likely LCP card for phones is preloaded with `fetchpriority="high"`; CSS is inlined;
  server HTML leaves out video previews and posters beyond the first 12.
- Real LCP with slow 4G + 4× CPU applied: 2.23 s → 0.96 s. Lighthouse mobile: score 88 → 95,
  LCP 3.86 → 2.98 s (local); live 83 → 93, 4.28 → 3.19 s. Still above 2.5 s in Lighthouse's
  simulation; reasons and next steps in `docs/PERF.md`.

## M1 · Media pipeline (2026-10-15)

- `lib/manifest.ts`: the `MediaItem` schema (zod), with rules for video fields, unique ids
  and a stable feed order. CI checks `data/manifest.json` against it.
- `lib/media-urls.ts`: every media URL and `srcset` comes from one place, never listing a
  width that doesn't exist.
- `pnpm media:dev`: 300 numbered test images and 40 test videos in six aspect ratios.
- `pnpm media:ingest`: AVIF and WebP posters, link-preview JPEGs, ThumbHashes, 2.5 s
  previews (capped to stay under 300 KB) and 720p clips, then upload to R2. Reruns change
  nothing.
- `data/manifest.json`: 340 synthetic items.
- All 3,916 files are on R2 at the public r2.dev address (`NEXT_PUBLIC_MEDIA_ORIGIN` in `.env`).
  Checked: content types, one-year immutable caching, CORS for the site and localhost, and
  range requests for video seeking.
- R2 free-tier guard in the upload, plus a daily usage check (`pnpm r2:usage`, R2 usage
  workflow) that fails at 80 % of any limit.
- Real AI media moved to M5. The custom domain and its cache rule come before M2's
  measurements.

## M0 · Setup and a live skeleton (2026-10-15)

- Next.js 16.4 app (App Router, React 19.3, TypeScript strict, Tailwind CSS 4.3) with a
  skeleton home page.
- Vitest and Testing Library for unit tests; Playwright (Chromium and WebKit) for e2e tests.
- GitHub Actions CI: lint, typecheck, unit tests, build, e2e.
- First-load JS baseline (132.3 KB gzip) and bundle budget (172.3 KB) in `docs/PERF.md`.
- Design tokens and an 8-board mockup canvas in `docs/design/`. The Figma frame is still to
  do.
- Tokens applied to the app: `app/tokens.css` (imported by `app/globals.css`) and the
  Instrument Sans font, replacing the scaffold's Geist font and default colors.
- Live on Vercel at https://generation-feed.vercel.app. Production deploys from `main`;
  every pull request gets a preview deploy.
- Deploys moved from Vercel's Git integration to a `deploy` job in CI that runs after all
  tests pass.
