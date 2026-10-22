import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import type { MediaItem } from "../lib/manifest";

const POSTER = readFileSync("e2e/fixtures/poster.png");
const PREVIEW = readFileSync("e2e/fixtures/preview.mp4");

/**
 * The feed the tests run against, in feed order: the small synthetic set, which the e2e build
 * and server use (FEED_MEDIA=synthetic), not the real media.
 */
export const manifest = JSON.parse(readFileSync("data/manifest.synthetic.json", "utf8")) as MediaItem[];

/** Every media file comes from small local fixtures: fast, stable, and no R2 traffic. */
export async function serveFixtureMedia(page: Page): Promise<void> {
  await page.route(/\/m\/[0-9a-v]{10}\/v\d+\/[^/]+$/, (route) => {
    const isVideo = route.request().url().endsWith(".mp4");
    return route.fulfill({
      body: isVideo ? PREVIEW : POSTER,
      contentType: isVideo ? "video/mp4" : "image/png",
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    });
  });
}

export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

/**
 * Waits until the feed is interactive: after hydration the grid swaps its server-placed cards
 * for pixel-placed ones. A click before that follows the plain link to the static page.
 */
export async function waitForInteractiveFeed(page: Page): Promise<void> {
  await expect(page.getByRole("listitem").first()).toBeVisible();
  await expect(page.locator('[data-slot="media-grid"][data-layout="pixels"]')).toHaveCount(1);
}
