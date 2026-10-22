# Performance log

Every optimization gets a before and after number here.

## Bundle budget (M0)

Measured on 2026-10-15 on the M0 skeleton (Next.js 16.4.1, React 19.3.0), as a production
build served locally with `pnpm start`, using `pnpm measure:js`. Two runs gave the same result.

| | gzip | raw | scripts |
| --- | --- | --- | --- |
| Empty-app first-load JS on `/` | 132.3 KB | 446.9 KB | 5 |
| **Budget for `/` (baseline + 40 KB)** | **172.3 KB** | | |
| M2 grid (virtualizer, infinite pages, ThumbHash, cards) | 155.2 KB (+22.9) | 520.6 KB | 6 |

How it's measured: `scripts/first-load-js.ts` opens the page in Chromium, records every
script request, downloads each file and gzips it (Node's default level). Lighthouse CI
enforces the budget from M6.

## Media pipeline (M1, synthetic set)

Measured on 2026-10-15 with `pnpm media:ingest --dry-run` on the 340 synthetic items
(300 images, 40 videos). Real AI media replaces them in M5, and its sizes will differ:
smooth gradients compress unusually well, and the noise-pattern videos unusually badly.

| Output | Files | Total | Typical |
| --- | --- | --- | --- |
| AVIF posters | 1,748 | 21.8 MB | avg 13 KB |
| WebP posters | 1,748 | 34.2 MB | avg 20 KB |
| JPEG link previews | 340 | 22.1 MB | avg 67 KB |
| Preview MP4s (2.5 s, 480p) | 40 | 5.4 MB | median 166 KB, max 226 KB |
| Full MP4s (720p) | 40 | 105.3 MB | median 1.8 MB, max 10.5 MB |
| **Uploaded to R2** | **3,916** | **188.7 MB** | |
| `data/manifest.json` | 1 | 123 KB | 340 items |

**Preview budget (≤ 300 KB): before and after the bitrate cap**

| | Median | Max | Over budget |
| --- | --- | --- | --- |
| CRF 28 only (spec settings) | 193 KB | 1,380 KB | 20 of 40 |
| + cap 850 kbit/s, 1,700 kbit buffer | 194 KB | 326 KB | 8 of 40 |
| + cap 700 kbit/s, 700 kbit buffer (kept) | 166 KB | 226 KB | 0 of 40 |

Only the busy "life" and "cellular automaton" clips hit the cap; test-card and gradient
previews (20–125 KB) came out byte-identical.

Time on an M-series MacBook Pro: about 4.5 minutes for the 300 images from scratch, about
1 minute for the 40 videos, and about 2 seconds for a rerun (everything comes from the
`media-out/` cache).

> **Caveat for every number from M2 on:** media is served from the free r2.dev address,
> which is rate-limited and not cached near visitors (Agzhan's call). Image
> and video timings include some of r2.dev's own slowness. The custom domain will get its own
> before/after row.

## Lighthouse (mobile)

Lighthouse 13.5.0, mobile preset (simulated slow 4G, 4× CPU slowdown), Chrome for Testing
156, headless, against https://generation-feed.vercel.app. 5 runs, median in bold.

| Version | Score | LCP | CLS | TBT | FCP |
| --- | --- | --- | --- | --- | --- |
| M2 naive grid (2026-10-16) | **83** (79–85) | **4.28 s** (3.95–5.35) ✗ | **0.000** | **23 ms** (19–35) | **1.16 s** (1.08–1.43) |
| Target | | ≤ 2.5 s | ≤ 0.05 | ≤ 200 ms | |

**Why LCP misses:** the LCP element is the first poster. It is preloaded and arrives early
(request starts at about 0.35 s, done by about 0.6 s in the unthrottled trace). But cards
only render after hydration, because masonry needs the grid's width. The breakdown's
largest part is "element render delay": waiting for JavaScript. On the simulated phone that
wait dominates. Spec 4.5's fallback is the fix: server-render the first screen, with
positions in `cqw`, so the poster can paint before any JavaScript runs.

## Bench: naive vs pooled video previews

`pnpm bench https://generation-feed.vercel.app --runs 3 --hovers 50`: Chrome for Testing,
1440 × 900, empty cache each run. It scrolls the whole feed at 12,000 px/s, then hovers video
cards 50 times (all 40 videos, then 10 again from the top). Hover → first frame is timed in the
page, from `pointerenter` to the first `requestVideoFrameCallback`, so it includes the 100 ms
hover intent. Heap is the JS heap after a forced GC; video buffers and decoders live outside
it, which is why "videos holding data" is listed too.

| Metric | Naive (`v0.2-naive`, 2026-10-16) | Pooled (M3) |
| --- | --- | --- |
| Max `<video>` elements in the DOM | 9 | |
| Max `<video>` elements holding data | 9 | |
| Max cards in the DOM | 70 | |
| JS heap after GC (after scroll / after hovers) | 6.0 / 5.7 MB | |
| Hover → first frame p50 / p95 | 131 / 149 ms | |
| Hovers with no frame within 5 s | 2 of 150 | |
| Bytes transferred (all / media) | 2.1 / 1.9 MB | |

Reading it: on desktop broadband the naive version is quick to start, because every mounted
video has already fetched its metadata (`preload="metadata"`). The cost is the other column:
one `<video>`, with its buffer and usually a decoder, per mounted video card, growing with
the screen size and the share of videos. M3's pool should cap that at 6 (2 on phones), and
its first hover may be a little slower (spec 4.7 expects this).
