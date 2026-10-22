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
| M2 + server first screen (own virtualization, no TanStack Virtual) | 146.5 KB (+14.2) | 489.8 KB | 6 |
| M3 video pool, previews, device policy | 148.6 KB (+16.3) | 495.1 KB | 7 |
| M3 with `?perf=1` (overlay chunk, web-vitals 3.0 KB) | 152.3 KB | 504.5 KB | 8 |
| M4 filters, header, states, detail controller | 153.4 KB (+21.1) | 510.1 KB | 7 |
| M4 + detail overlay chunk, fetched when the page is idle | 156.5 KB | 518.5 KB | 8 |
| M4 static `/m/[id]` page | 133.8 KB | 449.8 KB | 6 |

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

## M4: detail view, filters and states (2026-10-16)

Same Mac, same day, local production builds of M3 (`1221afa`) and M4 served by `next start`,
media from r2.dev. Lighthouse 13.5.0, mobile preset, Chrome for Testing 156; 5 runs each,
M3 and M4 alternating so drift hits both. Median, range in brackets.

| | M3 | M4, LCP pick unchanged | M4 |
| --- | --- | --- | --- |
| Lighthouse score | 93 (93–93) | 92 (91–92) | **92** (91–93) |
| Lighthouse LCP (simulated) | 3.17 s (3.10–3.18) | 3.30 s (3.25–3.40) | **3.26 s** (3.24–3.40) |
| Lighthouse TBT | 77 ms | 69 ms | **68 ms** |
| CLS | 0.000 | 0.000 | **0.000** |
| LCP element | #004 (preloaded) | #003 (not preloaded) | #003 (preloaded) |
| **LCP, applied throttling** (slow 4G + 4× CPU, 412 × 823, 6 runs) | 0.99 s (0.97–1.15) | | **0.90 s** (0.84–0.96) |
| FCP, applied throttling | 0.35 s | | 0.37 s |
| HTML of `/`, gzip | 25 KB | | 30 KB |

- **The LCP pick:** the phone header grew from 57 to 97 px (two rows, per the design), and on
  Lighthouse's phone card #003 became the largest on screen by 3 px, without the preload.
  Counting the header and gaps moved the preload to #003: 3.30 → 3.26 s in
  Lighthouse; with applied throttling M4's LCP is 0.09 s *faster* than M3's.
- **What's left of Lighthouse's +0.09 s:** about 5 KB more script before LCP, and the 3 KB
  overlay chunk, which an unthrottled trace fetches during idle time before the LCP image
  lands, so Lighthouse charges it to the simulated slow connection. In the trace itself M4
  paints its LCP sooner (268 vs 320 ms).
- **HTML +5 KB gzip:** mostly CSS. The inlined stylesheet now holds the header, overlay and
  detail styles (20.6 → 27.6 KB raw), and inline CSS also travels in the RSC payload.
- First-load JS 153.4 KB, 18.9 KB under the budget. The overlay chunk was 6.1 KB until
  `next/link` came out of it, and a `next/link` in `not-found.tsx` had added 3.3 KB to every
  page.

## M5: real media, before the upload (2026-10-17)

Same Mac, same day, local production builds served by `next start`, media for both served
from this Mac (`media-out/`, so the network is the same for both): the synthetic test set
("before", what production shows now) and the 1,097 real items ("after"). Lighthouse 13.5.0,
mobile preset, Chrome 155; 5 runs each, one build after the other (both can't be served at
once). Median, range in brackets.

| | Synthetic (before) | Real media (after) |
| --- | --- | --- |
| Lighthouse score | 94 (92–95) | **92** (91–97) |
| Lighthouse LCP (simulated) | 3.04 s (2.95–3.29) | **3.34 s** (2.58–3.49) |
| Lighthouse TBT | 37 ms | **38 ms** |
| CLS | 0.000 | **0.000** |
| FCP | 0.82 s | **0.83 s** |
| HTML of `/`, gzip | 30.5 KB | **33.5 KB** |
| LCP image (480 px AVIF) | 9 KB test pattern | **43 KB** (textures-15) |
| Static pages / build | 346, generated in 2.7 s | **1,103**, generated in 7.8 s |

- **LCP +0.3 s, lab only:** the first card's poster is now a real image, 43 KB where the test
  pattern was 9 KB, and its neighbours are photos too; on the simulated slow 4G that, plus 3 KB
  more HTML, is the 0.3 s. The first card happens to be dense film grain (textures-15, made
  last), the hardest thing to compress: a typical photo here is about 24 KB at that size. AVIF
  at quality 45 instead of 50 would make it 33 KB (about 20 % less everywhere) at some cost in
  quality.
- **HTML +3 KB gzip:** real prompts are longer than the test ones; the first page is still 40
  items.
- The ingest dry run: 1,097 items in 28 minutes; 13,602 files, 2.25 GB (0.81 GB of Feed files,
  1.40 GB of originals); hover previews median 115 KB, max 244 KB, all inside the 300 KB budget.

## M5: collection filter (2026-10-17)

Local production builds of the real media, before (`1a40090`) and after, served by `next start`.

| | Before | After |
| --- | --- | --- |
| First-load JS on `/` | 156.5 KB gzip | **156.6 KB** |
| HTML of `/`, gzip | 33.6 KB | **33.8 KB** (the 8 options) |
| Header, phone (375 px) | 97 px | **97 px**: the select joins the row that scrolls sideways |
| Header, 1024 px | one 57 px row | **two rows, 97 px**: one row needs about 1,105 px now |
| Header, 1280 px | one 57 px row | **one 57 px row** |

The phone header keeps its height, so the LCP pick (`PHONE_HEADER_HEIGHT`) is unchanged.

**Then the phone filter sheet** (the selects move behind a Filters button on phones): first-load
JS 156.6 → **157.2 KB** gzip, HTML of `/` 33.8 → **34.4 KB** gzip; the phone header stays 97 px.

## M6: Lighthouse CI on production (2026-10-17)

`pnpm lighthouse` (Lighthouse CI 0.15.1, Lighthouse 12.6.1), against production with the real
media from r2.dev, 3 mobile runs:

| Run | Performance | Accessibility | LCP | TBT | CLS | Scripts (transfer) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 79 | 100 | 4.58 s | 27 ms | 0.000 | 162.0 KB |
| 2 | 84 | 100 | 4.09 s | 22 ms | 0.000 | 162.0 KB |
| 3 (median) | 79 | 100 | 4.66 s | 17 ms | 0.000 | 162.1 KB |

Every budget passes except LCP, which only warns until M7. Live LCP is well above the local
3.3 s: the images come from r2.dev, Cloudflare's rate-limited development address, over a real
network, and the first poster is a 43 KB film-grain texture. A media domain of its own and the
first poster are the first things to look at in M7.

**Speed Insights** adds about 6 KB gzip to first-load JS (its 1.4 KB component and Vercel's
4.5 KB script): measured on production, 157.2 → **163.0 KB** gzip of the 172.3 KB budget
(`pnpm measure:js https://generation-feed.vercel.app/`, 10 scripts).

**The first run in CI (2026-10-17) failed on TBT.** GitHub's runner, same site, same settings:

| Run | TBT | LCP | Benchmark index | Main script (`41iri2ti6yhmj.js`, 73 KB) evaluated in |
| --- | --- | --- | --- | --- |
| 1 | 828 ms | 4.47 s | 1,685 | 1.57 s |
| 2 | 214 ms | 3.48 s | 2,164 | 0.81 s |
| 3 (median) | **297 ms** | 4.11 s | 2,147 | 0.86 s |
| This Mac, for comparison | 17–27 ms | 4.1–4.7 s | about 3,000 | 0.18–0.31 s |

Lighthouse slows the CPU 4× on both, so the shared CI runner (a slower, noisier CPU) lands
far higher. That script is mostly React and Next.js starting the page (hydration). Lighthouse's
CPU calibration guidance puts a mid-tier phone nearer the CI number than this Mac's, so the
start-up blocking about 0.2–0.3 s on mid-tier phones is a real finding for M7, next to LCP.

## M7: performance pass (2026-10-18)

### Start-up: no Intl

Local production build of the real feed, Chrome with the CPU slowed 4×, a CPU profile of each
page load (average of 3 loads), mapped to source files through the build's source maps (a
temporary `productionBrowserSourceMaps` build, not committed). "Busy" is main-thread time with
JavaScript, layout or garbage collection running until the page settles.

| | Before | `formatCount` | + `formatCreated` |
| --- | --- | --- | --- |
| Busy main thread per load | 709 ms | 587 ms | 572 / 590 ms (two sets) |
| `Header.tsx`: `toLocaleString("en")` | 43–46 ms | gone | gone |
| Detail chunk: `Intl.DateTimeFormat` at load | about 10 ms | 46 ms | gone |
| React DOM | 126 ms | 108 ms | 116–119 ms |
| ThumbHash (library + `lib/thumbhash.ts`) | about 32 ms | 31 ms | 30–31 ms |

Then the first page's 40 cards stopped decoding their ThumbHash after hydration (they keep the
server's average color until the poster loads): ThumbHash leaves the
profile (30–31 ms → 0), and busy time per load went 572 / 590 → 507 / 459 ms (two sets). The
drop is again larger than the row: the 40 decoded PNGs were also images to decode and paint.

The first `Intl` call on a page loads the browser's locale data, about 45 ms here. Removing the
header's call only moved that cost to the next `Intl` call (the detail chunk's date format,
10 → 46 ms); with both gone, it's off the start-up. The busy total fell by about 125 ms, much
more than the 45 ms these rows explain. The "before" profile ran earlier, under a different
load on this Mac, and two sets on the same build differ by about 20 ms, so only the per-file
rows are a like-for-like comparison: about 45–55 ms saved.

### Start-up: the long tasks after the first paint

The first CI run with TBT as an error failed on a slow runner (222 ms, budget 200). Where the
time goes, measured three ways:

- **CI's own reports:** after the first paint, the main framework script runs as two or three
  long tasks: about 170 + 65 ms on fast runners, 190 + 179 + 77 ms on the slow one.
- **A trace of each long task** (`longtask-trace.mjs`, local build with source maps, Lighthouse's
  phone size, CPU slowed 13×, which makes this Mac about as slow as a slow CI runner): one task
  evaluates the framework's scripts (180–340 ms; 129–177 ms of it in Turbopack's
  `instantiateModule`, mostly React DOM and the Next.js client runtime), then our page adds
  two: React finishing hydration (its effects, plus the switch to pixel layout starting) and
  the switch's DOM changes.
- **An empty Next.js page** (same config, home page reduced to one line, not committed) has the
  same start-up task: 248–314 ms at 13×, and a Lighthouse TBT of 198–289 ms with the optional
  features (Cache Components, partial prefetching, inline CSS) off, 215–279 ms with them on.
  So that task is the framework's floor; our code can't remove it.

What our page adds, CPU slowed 13×, real throttling (time over 50 ms in long tasks after the
framework's start-up task, median of 5–7 loads):

| Version | Our blocking | Long tasks |
| --- | --- | --- |
| Before | 37 ms (30–52) | two, 60–77 ms |
| + the switch to pixel layout as a transition | 15 ms (4–45) | one or two, 51–92 ms |
| + the same pool value on the server and in the browser | 12 ms (0–34) | none or one, 54–84 ms |
| + the pool made in a task of its own | **7 ms** (1–33) | one, 51–58 ms (once 79) |

Lighthouse run locally at the same CPU (simulated throttling, 7 runs) didn't move: 104 → 109 ms
median. Its simulation here is dominated by the framework's task and didn't show our second
task at all; on CI's runners that task was 65–179 ms, so CI is the measure for this change.
Rejected: replacing TanStack Query, which is 32 KB of the 515 KB of JavaScript that runs at
start-up (about 6 %) and would barely change the framework-sized task.

**On CI after the two cuts (28d983a), a slow runner again (benchmark index about 2,150):**

| Same-speed runner | Framework start-up task | Our second task | TBT, checked run |
| --- | --- | --- | --- |
| Before the cuts (9b701b0) | 190–304 ms | 101–179 ms | 222 ms ✗ |
| After the cuts (28d983a) | 144–283 ms | 56–84 ms | 283 ms ✗ |
| After the cuts, budget 350 ms (65a0341) | benchmark index 1,391–2,226 | | 139 ms ✓ (all runs 138–210) |

Our task roughly halved; the framework's task alone (260–283 ms) is already more than the
200 ms budget, since TBT counts everything over 50 ms. Lighthouse's throttling guide sets the
4× default for a high-end desktop (benchmark index about 1,500–2,000) and a higher multiplier
for faster machines, so these slow runners are the closest to its mid-tier phone, and calibrating
per runner would make the check stricter, not looser. In that phone's terms, the framework's
start-up blocks about 200 ms by itself.

### Live: posters from the site's own address

`pnpm lighthouse` in CI after each deploy (Lighthouse 12.6.1, mobile, simulated slow 4G and a
4× slower CPU on GitHub's shared runner), 5 runs. Medians of each metric, range in brackets;
"checked run" is the run with the median score, which `lighthouserc.json` asserts on.

| Deploy | Score | LCP | TBT | FCP | Checked run: LCP / TBT |
| --- | --- | --- | --- | --- | --- |
| Before M7 (r2.dev) | 78 | 4.91 s (2.48–5.08) | 34 ms (27–59) | 1.83 s | 4.91 s / 27 ms |
| a2f051e: all media via the site (reverted) | 95 | 2.57 s (1.97–3.30) | 87 ms (75–1,121) | 1.04 s | 2.57 s / 87 ms |
| 5b97d50: the revert, r2.dev again | 83 | 3.94 s (3.87–4.75) | 207 ms (139–471) | 1.14 s | 3.94 s / 239 ms |
| 9a0a529: posters via the site, no Intl | 96 | 2.31 s (1.82–3.00) | 104 ms (72–250) | 1.03 s | 2.72 s / 104 ms |
| 6bd5aaa: + first-page cards keep the color | 97 | 2.59 s (2.41–3.24) | 71 ms (70–334) | 1.04 s | 2.41 s / 71 ms |
| a3d797c: + Safari unlock, TBT an error again | 96 | 2.26 s (1.96–2.71) | 183 ms (159–395) | 1.07 s | 1.96 s / 183 ms |

The first poster is the same file in every row (`skjvttjl7o/v1/480.avif`, 43 KB); only its
address changed. Serving it from the page's own origin saves the second connection (DNS, TCP
and TLS at a simulated 150 ms round trip), and Vercel's CDN serves repeat requests near the
visitor instead of from r2.dev. The revert row ran the same code as "before" and shows how much
the shared runner moves TBT: 34 → 207 ms with no change to the page.

LCP now sits at the 2.5 s budget rather than under it: the five runs of the last two deploys
range from 1.82 to 3.24 s, so an error on LCP would fail about half the runs. The first poster
is the lever left: a film-grain texture that stays 42 KB at 480 px (its neighbours are 3–23
KB). Encoder settings don't shrink it (4:2:0 chroma, effort 9: within 1 KB); only a lower
quality does (q40: 23 KB, q35: 17 KB), which smooths the dust specks that are the image's point.
TBT is under budget on the checked run of both deploys, so it fails the run again.

**Why TBT is higher than before M7, though start-up work went down.** Lighthouse counts
blocking time only after the first paint (FCP). Before M7 the first paint came late (1.81–1.95
s), so most of the framework's start-up ran before it and wasn't counted: 34 ms. The revert
deploy ran the same code as "before", painted at 1.13–1.37 s, and measured 139–471 ms. An
earlier paint exposes the start-up work to TBT; it doesn't add any. The start-up itself got
cheaper (the profiles above: about 45 ms of `Intl` and 30 ms of ThumbHash gone).

The last row's TBT rise is the runner, not the page (the Safari unlock only runs after a
click, which Lighthouse never makes): its benchmark index was about 2,100 against about 3,700
for the run before, and JavaScript boot-up took 670–750 ms instead of 480–520 ms. On a runner
that slow, TBT sits close to its 200 ms budget, so the next start-up cuts (React's own work is
now the largest part) are what keep that error from failing on noise.

Checked on production after 9a0a529: a poster answers MISS then HIT with the whole file; a
request with `Range` gets a 307 to the bucket, and plain requests after it still get the whole
file; a conditional request (`If-None-Match`) doesn't change what's cached (same SHA-256 as
the bucket's copy); `/m/<id>/v1/preview.mp4` on the site is a 404; videos from the bucket
answer ranges with 206.

## Lighthouse (mobile)

Lighthouse 13.5.0, mobile preset (simulated slow 4G, 4× CPU slowdown), Chrome for Testing
156, headless, against https://generation-feed.vercel.app. 5 runs, median in bold.

| Version | Score | LCP | CLS | TBT | FCP |
| --- | --- | --- | --- | --- | --- |
| M2 naive grid (2026-10-16) | **83** (79–85) | **4.28 s** (3.95–5.35) ✗ | **0.000** | **23 ms** (19–35) | **1.16 s** (1.08–1.43) |
| M2 + server-rendered first screen (2026-10-16) | **93** (81–95) | **3.19 s** (2.81–4.39) ✗ | **0.000** | **27 ms** | **1.69 s** (1.32–1.87) |
| Target | | ≤ 2.5 s | ≤ 0.05 | ≤ 200 ms | |

**Why the naive grid missed:** the LCP element is a poster. It was preloaded and arrived early
(done by about 0.6 s in the unthrottled trace), but cards only rendered after hydration,
because masonry needed the grid's width. Most of LCP was "element render delay": waiting for
JavaScript.

**What changed**: the first page is now placed in CSS on the
server (`cqw` + container queries), with posters for the first 12 cards only, no video
previews, inline CSS, the likely LCP card preloaded with high priority, and the switch to
pixel layout after the first paint.

### Same machine, naive vs finished (local production builds)

Both builds served by `next start` on the same Mac, media from r2.dev, same day. Lighthouse:
5 runs each. "Applied throttling": Chrome for Testing with slow 4G (1.6 Mbit/s, 150 ms) and 4×
CPU set through CDP, 412 × 823 phone viewport, LCP read from the page's own
PerformanceObserver; 3 runs each.

| | Naive (`v0.2-naive`) | Server first screen | Change |
| --- | --- | --- | --- |
| Lighthouse score | 88 (86–89) | **95** (94–95) | +7 |
| Lighthouse LCP (simulated) | 3.86 s (3.77–4.27) | **2.98 s** (2.95–3.10) | −23 % |
| Lighthouse TBT | 40 ms | **18 ms** | −55 % |
| Lighthouse FCP | 0.76 s | 0.81 s | +0.05 s |
| **LCP, applied throttling** | 2.23 s (2.23–2.67) | **0.96 s** (0.95–1.03) | **−57 %** |
| FCP, applied throttling | 0.63 s | **0.37 s** | −41 % |
| Live LCP, applied throttling (Vercel + r2.dev) | | 1.15–1.26 s | |

**Why Lighthouse's LCP stays above 2.5 s while real throttled LCP is about 1 s:** Lighthouse
records an unthrottled trace and then *simulates* a slow phone, charging every download that
started before LCP (the framework's ~146 KB of scripts, the posters, the font) to one slow
connection. In the slower live runs the LCP poster has arrived by about 0.6 s, but the first
paint waits about 2 s behind script start-up in Lighthouse's cold, traced browser. Most of that
script is the framework itself: the empty Next.js app was 132 KB gzip.

## Bench: naive vs pooled video previews

`pnpm bench https://generation-feed.vercel.app --runs 3 --hovers 50`: Chrome for Testing,
1440 × 900, empty cache each run. It scrolls the whole feed at 12,000 px/s, then hovers video
cards 50 times (all 40 videos, then 10 again from the top). Hover → first frame is timed in the
page, from `pointerenter` to the first `requestVideoFrameCallback`, so it includes the 100 ms
hover intent. Heap is the JS heap after a forced GC; video buffers and decoders live outside
it, which is why "videos holding data" is listed too.

| Metric | Naive (`v0.2-naive`) | Naive + server first screen | Pooled (M3) |
| --- | --- | --- | --- |
| Max `<video>` elements in the DOM | 9 | 7 | **5** (never more than 6 exist) |
| Max `<video>` elements holding data | 9 | 7 | **5** |
| Max cards in the DOM | 70 | 51 | 51 |
| JS heap after GC (after scroll / after hovers) | 6.0 / 5.7 MB | 5.8 / 5.5 MB | 5.8 / 5.6 MB |
| Hover → first frame p50 / p95 | 131 / 149 ms | 132 / 149 ms | **298 / 415 ms** |
| Hovers with no frame within 5 s | 2 of 150 | 2 of 150 | 1 of 150 |
| Bytes transferred (all / media) | 2.1 / 1.9 MB | 2.3 / 2.1 MB | **7.2 / 6.9 MB** |

The middle column is the naive previews on the new grid (own virtualization: about one
screen above and below, instead of TanStack Virtual's 4 rows). M3's "after" is compared with
it, since both use the same grid.

Reading it: on desktop broadband the naive version is quick to start, because every mounted
video has already fetched its metadata (`preload="metadata"`). The cost: one `<video>`, with
its buffer and usually a decoder, per mounted video card, growing with the screen size and
the share of videos.

**The pool (M3, 2026-10-16, same live site and r2.dev origin).** The number of videos is
now capped by design: at most 6 `<video>` elements are ever created (2 on phones). The bench
saw 5 at once in the DOM; e2e test 3 checks that 30 fast hovers never create more than 6. The
price is the one spec 4.7 predicts: a video downloads nothing until a card asks for it
(`preload="none"`), so the first hover on a card goes to the network, and hover → first
frame rises from 132 to 298 ms p50 (still inside the ≤ 300 ms aim) and 415 ms p95. A warm
card (hovered recently, its video not stolen) restarts at once.

The second cost: bytes. `acquire()` sets `preload="auto"` (spec 4.7), so each hovered card
downloads its whole preview (≤ 226 KB), while the naive version only fetched what played
during the 0.6 s hover: 7.2 MB against 2.3 MB for 50 hovers. Scrolling alone now downloads
no video at all. Options for the M7 pass, measured against this row: `preload="metadata"`
on acquire, and warming the most likely next card. Both are worth testing only after the
custom domain, since r2.dev's uncached latency dominates the first-frame time.

The JS heap doesn't change, because video buffers and decoders live outside it. On phones
the pool is 2 (checked by hand: at most 2 `<video>` in the DOM, and only the centered card
playing).

## The grid, the card and the pool from the Genframe Kit (2026-10-21)

Measured on 2026-10-21, a production build of the real feed served locally (`pnpm build`,
`pnpm start`), before (main, a599053) and after (this branch); `pnpm measure:js` for the scripts,
each page's HTML gzipped with Node's default level. Speed Insights isn't in local builds, so the live
first load is about 6 KB more in both.

| | Before | After | Change |
| --- | --- | --- | --- |
| First-load JS on `/`, gzip | 158.9 KB (9 scripts) | 161.0 KB (9 scripts) | +2.1 KB, of the 172.3 KB budget |
| First-load JS on `/m/[id]`, gzip | 135.2 KB (7 scripts) | 135.2 KB (7 scripts) | none |
| HTML of `/`, gzip | 34,088 B | 35,005 B | +917 B |
| HTML of `/`, raw | 176,751 B | 197,684 B | +20.9 KB: the 40 cards' markup |
| HTML of `/m/skjvttjl7o`, gzip | 21,562 B | 21,715 B | +153 B: the inlined CSS holds the Kit's classes |

- The scripts grow by 2.1 KB: the Kit's card and grid do more than the feed's (a card can be a
  button with a caption and a description, keyboard focus plays a preview, every card reads the
  reduced-motion setting itself, the ThumbHash cache is bounded), and `media-grid.css` became
  JavaScript that writes the same container queries. The Kit's own budgets for these items are in
  its docs/PERF.md.
- The HTML of `/` grows by 0.9 KB gzip (21 KB raw, which compresses well): each server card has a
  wrapper for its buttons and longer class lists, and the first-screen CSS moved from the inlined
  stylesheet into the grid's own `<style>`, about 700 bytes.
- Lighthouse runs on production after a deploy, so it measures this after the merge: TBT and the
  script-size budget (176,435 B transfer) are the ones to watch; locally, the first-load script
  grew 1.3%.
- Tests: 197 unit and component tests (202 before: `PooledPreview`'s 4 and `createMediaUrls`'s 1
  went with that code, which the Kit tests now), and all 75 end-to-end tests in Chromium, WebKit and
  Firefox, the server/client layout check at four widths among them.
