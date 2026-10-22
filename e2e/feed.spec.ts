import { expect, test, type Page } from "@playwright/test";
import type { FeedPage } from "../lib/feed";
import { collectErrors, manifest, serveFixtureMedia, waitForInteractiveFeed } from "./helpers";


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

interface CardRect {
  position: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

function readCards(page: Page): Promise<CardRect[]> {
  return page.$$eval('[role="listitem"]', (cards) =>
    cards.map((card) => {
      const rect = card.getBoundingClientRect();
      return {
        position: Number(card.getAttribute("aria-posinset")),
        x: rect.x,
        y: rect.y + window.scrollY,
        width: rect.width,
        height: rect.height,
      };
    }),
  );
}

for (const width of [390, 800, 1280, 1600]) {
  test(`the server-rendered first screen matches the client layout at ${width} px`, async ({ browser }) => {
    const viewport = { width, height: 900 };

    // Without JavaScript: the server HTML alone, placed by CSS (and still a list of links).
    const noScript = await browser.newContext({ viewport, javaScriptEnabled: false });
    const serverPage = await noScript.newPage();
    await serveFixtureMedia(serverPage);
    await serverPage.goto("/");
    const server = await readCards(serverPage);
    expect(server).toHaveLength(40);
    await expect(serverPage.locator('[role="listitem"] a[href^="/m/"]')).toHaveCount(40);
    await noScript.close();

    // With JavaScript: after hydration the grid places cards in pixels.
    const context = await browser.newContext({ viewport });
    const clientPage = await context.newPage();
    await serveFixtureMedia(clientPage);
    await clientPage.goto("/");
    await clientPage.locator('[data-slot="media-grid"][data-layout="pixels"]').waitFor();
    const client = await readCards(clientPage);
    await context.close();

    const serverByPosition = new Map(server.map((card) => [card.position, card]));
    const compared = client.filter((card) => serverByPosition.has(card.position));
    expect(compared.length).toBeGreaterThan(5);
    for (const card of compared) {
      const before = serverByPosition.get(card.position)!;
      for (const key of ["x", "y", "width", "height"] as const) {
        expect(Math.abs(card[key] - before[key]), `card ${card.position} ${key}`).toBeLessThan(0.5);
      }
    }
  });
}

test("scrolling to the end of 1,000 items keeps at most 150 cards in the page", async ({ page }) => {
  test.setTimeout(120_000);
  const TOTAL = 1000;
  const PAGE_SIZE = 40;

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

/** Later pages hold only videos (cloned from the real ones), so there are plenty to hover. */
async function serveVideoOnlyPages(page: Page): Promise<void> {
  const videos = manifest.filter((item) => item.kind === "video");
  await page.route("**/api/media?*", (route) => {
    const cursor = new URL(route.request().url()).searchParams.get("cursor") ?? "";
    const pageNumber = /^v\d+$/.test(cursor) ? Number(cursor.slice(1)) : 1;
    const items = Array.from({ length: 40 }, (_, offset) => {
      const n = pageNumber * 40 + offset;
      return { ...videos[n % videos.length], id: `f${n.toString(32).padStart(9, "0")}` };
    });
    const body: FeedPage = { items, nextCursor: pageNumber < 5 ? `v${pageNumber + 1}` : null, total: 240 };
    return route.fulfill({ json: body });
  });
}

test("a fast hover sweep over 30 video cards never makes more videos than the pool holds", async ({ page }) => {
  test.setTimeout(90_000);
  // Count every <video> the page ever creates, not just the ones in the DOM right now.
  await page.addInitScript(() => {
    const scope = window as typeof window & { __videosCreated: number };
    scope.__videosCreated = 0;
    const create = Document.prototype.createElement;
    Document.prototype.createElement = function (this: Document, name: string, options?: ElementCreationOptions) {
      if (name.toLowerCase() === "video") scope.__videosCreated++;
      return create.call(this, name, options);
    } as typeof Document.prototype.createElement;
  });
  await serveVideoOnlyPages(page);
  await page.setViewportSize({ width: 1440, height: 900 }); // a mouse device: pool of 6
  await page.goto("/");
  // Counting cards before the switch to the client layout would count server cards that the
  // switch then unmounts.
  await waitForInteractiveFeed(page);

  let hovered = 0;
  let maxInDom = 0;
  for (let step = 0; step < 80 && hovered < 30; step++) {
    const cards = page.locator('[role="listitem"]:has-text("Video ·") a');
    for (let i = 0, count = await cards.count(); i < count && hovered < 30; i++) {
      const box = await cards.nth(i).boundingBox();
      if (box === null || box.y < 60 || box.y + box.height > 900) continue;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(150); // just past the 100 ms hover intent
      hovered++;
      maxInDom = Math.max(maxInDom, await page.locator("video").count());
    }
    await page.mouse.wheel(0, 800);
    await page.waitForTimeout(100);
  }

  expect(hovered).toBe(30);
  const created = await page.evaluate(() => (window as typeof window & { __videosCreated: number }).__videosCreated);
  expect(created).toBeLessThanOrEqual(6);
  expect(maxInDom).toBeLessThanOrEqual(6);
});

test("hovering a video card starts playback within 1.5 s", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  // Server cards have no previews; hover once the client layout is in.
  await waitForInteractiveFeed(page);
  const card = page.locator('[role="listitem"]:has-text("Video ·") a').first();
  await expect(card).toBeVisible();
  await card.hover();

  const video = card.locator("video");
  await expect
    .poll(() => video.evaluate((element) => !(element as HTMLVideoElement).paused && (element as HTMLVideoElement).currentTime > 0), {
      timeout: 1500,
    })
    .toBe(true);
});

test("with reduced motion nothing plays by itself, and video cards show play buttons", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const card = page.locator('[role="listitem"]:has-text("Video ·")').first();
  await expect(card.getByRole("button", { name: "Play preview" })).toBeVisible();

  // Near the corner: the play button covers the card's center.
  await card.locator("a").hover({ position: { x: 12, y: 40 } });
  await page.waitForTimeout(600);
  await expect(page.locator("video")).toHaveCount(0);

  await card.getByRole("button", { name: "Play preview" }).click();
  await expect(card.getByRole("button", { name: "Pause preview" })).toBeVisible();
  await expect(card.locator("video")).toHaveCount(1);
});
