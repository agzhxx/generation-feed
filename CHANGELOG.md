# Changelog

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
