// Feed benchmark (spec 5): scrolls the whole feed at a fixed speed, then hovers video cards,
// and reports max live <video> elements, JS heap after garbage collection, hover → first
// frame (p50/p95) and bytes transferred. It only watches the page from outside, so the same
// script measures the naive previews (M2) and the video pool (M3) the same way.
//
// Usage: pnpm bench [url] [--runs 3] [--hovers 50]   (default url: http://localhost:3000)
// Each run uses a fresh browser profile (empty cache) at 1440 × 900.
import { parseArgs } from "node:util";
import { chromium, type CDPSession, type Page } from "@playwright/test";

const SCROLL_STEP_PX = 600;
const SCROLL_STEP_MS = 50; // 12,000 px/s
const HOVER_DWELL_MS = 600;
const FIRST_FRAME_TIMEOUT_MS = 5000;

interface RunResult {
  maxVideosInDom: number;
  maxVideosLoaded: number;
  maxCards: number;
  heapAfterScrollMb: number;
  heapAfterHoversMb: number;
  firstFrameMs: number[];
  timeouts: number;
  bytesByType: Record<string, number>;
}

async function heapAfterGcMb(cdp: CDPSession): Promise<number> {
  await cdp.send("HeapProfiler.collectGarbage");
  const { usedSize } = await cdp.send("Runtime.getHeapUsage");
  return usedSize / 1024 / 1024;
}

async function domCounts(page: Page) {
  return page.evaluate(() => {
    const videos = [...document.querySelectorAll("video")];
    const cards = [...document.querySelectorAll('[role="listitem"]')];
    return {
      cards: cards.length,
      videos: videos.length,
      // Elements that hold media data: each one costs memory and usually a decoder.
      videosLoaded: videos.filter((video) => video.readyState >= HTMLMediaElement.HAVE_METADATA).length,
      lastPosition: Math.max(0, ...cards.map((card) => Number(card.getAttribute("aria-posinset")))),
      total: Number(cards[0]?.getAttribute("aria-setsize") ?? 0),
    };
  });
}

/**
 * Hover → first painted video frame, timed inside the page with one clock. The grid is
 * virtualized, so a card further down only exists once the page has scrolled near it:
 * scroll down step by step until it does. Positions are hovered in ascending order.
 */
async function hoverFirstFrame(page: Page, position: number): Promise<number | null> {
  const card = page.locator(`[role="listitem"][aria-posinset="${position}"] a`);
  for (let step = 0; step < 400 && (await card.count()) === 0; step++) {
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(30);
  }
  if ((await card.count()) === 0) return null;
  await card.scrollIntoViewIfNeeded();
  await page.mouse.move(2, 2);
  const measured = card.evaluate(
    (link, timeoutMs) =>
      new Promise<number | null>((resolve) => {
        const timer = window.setTimeout(() => resolve(null), timeoutMs);
        link.addEventListener(
          "pointerenter",
          (event) => {
            const start = event.timeStamp;
            const watch = () => {
              const video = link.querySelector("video");
              if (video === null) {
                requestAnimationFrame(watch);
                return;
              }
              video.requestVideoFrameCallback((now) => {
                window.clearTimeout(timer);
                resolve(now - start);
              });
            };
            watch();
          },
          { once: true },
        );
      }),
    FIRST_FRAME_TIMEOUT_MS,
  );
  const box = await card.boundingBox();
  if (box === null) return null;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 2 });
  const result = await measured;
  await page.waitForTimeout(HOVER_DWELL_MS);
  return result;
}

async function runOnce(url: string, hovers: number): Promise<RunResult> {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  const typeById = new Map<string, string>();
  const bytesByType: Record<string, number> = {};
  cdp.on("Network.responseReceived", (event) => typeById.set(event.requestId, event.type.toLowerCase()));
  cdp.on("Network.loadingFinished", (event) => {
    const type = typeById.get(event.requestId) ?? "other";
    bytesByType[type] = (bytesByType[type] ?? 0) + event.encodedDataLength;
  });

  await page.goto(url, { waitUntil: "networkidle" });
  await page.mouse.move(2, 2);

  // 1. Scroll to the end at a fixed speed.
  let maxVideosInDom = 0;
  let maxVideosLoaded = 0;
  let maxCards = 0;
  const videoPositions = new Set<number>();
  for (let step = 0; step < 2000; step++) {
    await page.mouse.wheel(0, SCROLL_STEP_PX);
    await page.waitForTimeout(SCROLL_STEP_MS);
    const counts = await domCounts(page);
    maxVideosInDom = Math.max(maxVideosInDom, counts.videos);
    maxVideosLoaded = Math.max(maxVideosLoaded, counts.videosLoaded);
    maxCards = Math.max(maxCards, counts.cards);
    // Video cards by their "Video · 5s" badge, whether or not they hold a <video> right now.
    for (const position of await page.$$eval('[role="listitem"]:has-text("Video ·")', (cards) =>
      cards.map((card) => Number(card.getAttribute("aria-posinset"))),
    )) {
      videoPositions.add(position);
    }
    if (counts.total > 0 && counts.lastPosition >= counts.total) break;
  }
  await page.waitForTimeout(1000);
  const heapAfterScrollMb = await heapAfterGcMb(cdp);

  // 2. Hover video cards from the top, cycling through them until `hovers` is reached.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  const positions = [...videoPositions].sort((a, b) => a - b);
  const firstFrameMs: number[] = [];
  let timeouts = 0;
  for (let i = 0; i < hovers && positions.length > 0; i++) {
    if (i > 0 && i % positions.length === 0) {
      // Every video was hovered once; start the next pass from the top.
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);
    }
    const ms = await hoverFirstFrame(page, positions[i % positions.length]);
    if (ms === null) timeouts++;
    else firstFrameMs.push(ms);
    const counts = await domCounts(page);
    maxVideosInDom = Math.max(maxVideosInDom, counts.videos);
    maxVideosLoaded = Math.max(maxVideosLoaded, counts.videosLoaded);
  }
  const heapAfterHoversMb = await heapAfterGcMb(cdp);

  await browser.close();
  return { maxVideosInDom, maxVideosLoaded, maxCards, heapAfterScrollMb, heapAfterHoversMb, firstFrameMs, timeouts, bytesByType };
}

function percentile(values: number[], share: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))] ?? NaN;
}

function median(values: number[]): number {
  return percentile(values, 0.5);
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { runs: { type: "string", default: "3" }, hovers: { type: "string", default: "50" } },
  });
  const url = positionals[0] ?? "http://localhost:3000";
  const runs = Number(values.runs);
  const hovers = Number(values.hovers);

  const results: RunResult[] = [];
  for (let run = 1; run <= runs; run++) {
    console.log(`Run ${run}/${runs} on ${url} …`);
    const result = await runOnce(url, hovers);
    results.push(result);
    console.log(
      `  max videos ${result.maxVideosInDom} (${result.maxVideosLoaded} loaded), max cards ${result.maxCards}, ` +
        `heap ${result.heapAfterScrollMb.toFixed(1)} / ${result.heapAfterHoversMb.toFixed(1)} MB, ` +
        `first frame p50 ${median(result.firstFrameMs).toFixed(0)} ms, timeouts ${result.timeouts}`,
    );
  }

  const allFrames = results.flatMap((result) => result.firstFrameMs);
  const totalMb = results.map((result) => Object.values(result.bytesByType).reduce((sum, bytes) => sum + bytes, 0) / 1024 / 1024);
  const mediaMb = results.map((result) => ((result.bytesByType.image ?? 0) + (result.bytesByType.media ?? 0)) / 1024 / 1024);
  const summary = {
    url,
    runs,
    hoversPerRun: hovers,
    maxVideosInDom: Math.max(...results.map((result) => result.maxVideosInDom)),
    maxVideosLoaded: Math.max(...results.map((result) => result.maxVideosLoaded)),
    maxCards: Math.max(...results.map((result) => result.maxCards)),
    heapAfterScrollMb: +median(results.map((result) => result.heapAfterScrollMb)).toFixed(1),
    heapAfterHoversMb: +median(results.map((result) => result.heapAfterHoversMb)).toFixed(1),
    firstFrameP50Ms: Math.round(percentile(allFrames, 0.5)),
    firstFrameP95Ms: Math.round(percentile(allFrames, 0.95)),
    firstFrameTimeouts: results.reduce((sum, result) => sum + result.timeouts, 0),
    transferredMb: +median(totalMb).toFixed(1),
    mediaTransferredMb: +median(mediaMb).toFixed(1),
  };
  console.log(`\n${JSON.stringify(summary, null, 2)}`);
}

await main();
