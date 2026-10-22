# Generation Feed

A gallery of 1,000+ AI-generated images and short videos that opens instantly, never jumps,
and plays a video preview the moment you hover, even on a mid-range phone.

> Work in progress (M2, the grid with naive video previews, done). Live: https://generation-feed.vercel.app

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 · Vitest +
Testing Library · Playwright · GitHub Actions · Vercel · Cloudflare R2 · sharp + ffmpeg

## Run it locally

Needs Node 24 (`nvm use`) and pnpm (`corepack enable`).

```bash
pnpm install
pnpm dev
```

| Command | What it does |
| --- | --- |
| `pnpm dev` | Dev server at http://localhost:3000 |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | Generates route types, then runs `tsc` |
| `pnpm test` | Unit and component tests (Vitest) |
| `pnpm build` | Production build |
| `pnpm test:e2e` | End-to-end tests in Chromium and WebKit (run `pnpm build` first) |
| `pnpm measure:js` | First-load JS in gzip bytes (run `pnpm start` first) |
| `pnpm media:dev` | Makes 300 test images and 40 test videos in `media-src/dev/` (needs ffmpeg) |
| `pnpm media:ingest` | Encodes them into `media-out/`, writes `data/manifest.json`, uploads to R2 (`--dry-run` skips the upload) |
| `pnpm r2:usage` | This month's R2 usage against the free tier |
| `pnpm bench [url]` | Scroll + hover benchmark: max videos, heap, hover → first frame, bytes |

Settings: `.env` holds public values that are safe to commit, such as the media origin.
Secrets, like the R2 keys, go in `.env.local`, which is gitignored.

## Media and the R2 free tier

Media files live in Cloudflare R2, on the free tier: 10 GB of storage, 1 million writes and
10 million reads a month, and free downloads. Two guards keep the project inside it:

- `pnpm media:ingest` stops before uploading if the bucket would pass half the free storage,
  or if one run would use more than 10 % of the month's free writes. It also remembers what
  is already uploaded, so a rerun sends no requests.
- `pnpm r2:usage` shows this month's usage for the whole Cloudflare account. The **R2 usage**
  workflow runs it every day and fails when any limit passes 80 %, and GitHub emails the
  failure. It needs two repository secrets: `CLOUDFLARE_API_TOKEN` (a token with
  Account › Account Analytics › Read) and `R2_ACCOUNT_ID`.

## Deploys

GitHub Actions deploys to Vercel once every check passes: pushes to `main` go to production,
and each pull request gets a preview link. Vercel's own Git deploys are off (`vercel.json`).
The deploy job needs a `VERCEL_TOKEN` repository secret holding a token from the Vercel
account that owns the project.

## Docs

- [Design](docs/design/README.md): tokens, mockup boards and the Figma steps
- [Performance log](docs/PERF.md): budgets and before/after numbers
- [Changelog](CHANGELOG.md)
