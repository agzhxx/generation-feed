import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import type { FeedPage } from "../lib/feed";
import type { MediaItem } from "../lib/manifest";

const POSTER = readFileSync("e2e/fixtures/poster.png");
const PREVIEW = readFileSync("e2e/fixtures/preview.mp4");

/** Every media file comes from small local fixtures: fast, stable, and no R2 traffic. */
async function serveFixtureMedia(page: Page): Promise<void> {
  await page.route(/\/m\/[0-9a-v]{10}\/v\d+\/[^/]+$/, (route) => {
    const isVideo = route.request().url().endsWith(".mp4");
    return route.fulfill({
      body: isVideo ? PREVIEW : POSTER,
      contentType: isVideo ? "video/mp4" : "image/png",
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    });
  });
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test.beforeEach(async ({ page }) => {
  await serveFixtureMedia(page);
});

test("home loads without console errors or layout shift", async ({ page, browserName }) => {
  // Sum every layout shift from the first paint on (Chromium only: WebKit has no API for it).
  await page.addInitScript(() => {
    const scope = window as typeof window & { __cls: number };
    scope.__cls = 0;
    if (!PerformanceObserver.supportedEntryTypes.includes("layout-shift")) return;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
        if (!entry.hadRecentInput) scope.__cls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  const errors = collectErrors(page);

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Generation Feed" })).toBeVisible();
  await expect(page.getByRole("listitem").first()).toBeVisible();
  await page.mouse.wheel(0, 1500);
  await page.waitForTimeout(500);

  expect(errors).toEqual([]);
  if (browserName === "chromium") {
    const cls = await page.evaluate(() => (window as typeof window & { __cls: number }).__cls);
    expect(cls).toBeLessThan(0.01);
  }
});

test("scrolling to the end of 1,000 items keeps at most 150 cards in the page", async ({ page }) => {
  test.setTimeout(120_000);
  const TOTAL = 1000;
  const PAGE_SIZE = 40;
  const manifest = JSON.parse(readFileSync("data/manifest.json", "utf8")) as MediaItem[];

  // The first 40 items come from the server HTML; every later page is made up here, cloning
  // the real items with new ids until there are 1,000.
  await page.route("**/api/media?*", (route) => {
    const cursor = new URL(route.request().url()).searchParams.get("cursor") ?? "";
    const pageNumber = /^p\d+$/.test(cursor) ? Number(cursor.slice(1)) : 1;
    const start = pageNumber * PAGE_SIZE;
    const items = Array.from({ length: Math.min(PAGE_SIZE, TOTAL - start) }, (_, offset) => {
      const n = start + offset;
      const source = manifest[n % manifest.length];
      return { ...source, id: `e${n.toString(32).padStart(9, "0")}` };
    });
    const body: FeedPage = {
      items,
      nextCursor: start + items.length < TOTAL ? `p${pageNumber + 1}` : null,
      total: TOTAL,
    };
    return route.fulfill({ json: body });
  });

  await page.goto("/");
  await expect(page.getByRole("listitem").first()).toBeVisible();

  let maxCards = 0;
  let lastPosition = 0;
  for (let step = 0; step < 600 && lastPosition < TOTAL; step++) {
    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(25);
    const state = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('[role="listitem"]')];
      return { cards: cards.length, last: Math.max(...cards.map((card) => Number(card.getAttribute("aria-posinset")))) };
    });
    maxCards = Math.max(maxCards, state.cards);
    lastPosition = Math.max(lastPosition, state.last);
  }

  expect(lastPosition).toBe(TOTAL);
  expect(maxCards).toBeLessThanOrEqual(150);
});
