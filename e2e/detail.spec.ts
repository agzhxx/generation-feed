import { expect, test } from "@playwright/test";
import { manifest, serveFixtureMedia, waitForInteractiveFeed } from "./helpers";

test.beforeEach(async ({ page }) => {
  await serveFixtureMedia(page);
});

test("clicking a card opens the detail view at /m/<id>; Esc returns to / with focus on that card", async ({ page }) => {
  await page.goto("/");
  await waitForInteractiveFeed(page);
  const card = page.getByRole("listitem").nth(2).getByRole("link");
  const href = await card.getAttribute("href");
  await card.click();

  await expect(page).toHaveURL(href!);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(manifest[2].prompt).first()).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Close" }).first()).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(page).toHaveURL("/");
  await expect(dialog).toHaveCount(0);
  await expect(card).toBeFocused();
});

test("← and → step through the feed without new history entries; Back closes on the item you ended on", async ({ page }) => {
  await page.goto("/");
  await waitForInteractiveFeed(page);
  await page.getByRole("listitem").first().getByRole("link").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const entries = await page.evaluate(() => history.length);

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(`/m/${manifest[2].id}`);
  await expect(page.getByRole("dialog").getByRole("complementary").getByText("3 of 340")).toBeVisible();
  await page.keyboard.press("ArrowLeft");
  await expect(page).toHaveURL(`/m/${manifest[1].id}`);
  expect(await page.evaluate(() => history.length)).toBe(entries);

  await page.goBack();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator('[aria-posinset="2"] a')).toBeFocused();
});

test("Ctrl/Cmd-click keeps normal link behavior", async ({ page, context }) => {
  await page.goto("/");
  await waitForInteractiveFeed(page);
  const card = page.getByRole("listitem").first().getByRole("link");
  const [opened] = await Promise.all([context.waitForEvent("page"), card.click({ modifiers: ["ControlOrMeta"] })]);
  // The new tab starts at about:blank.
  await expect(opened).toHaveURL(`/m/${manifest[0].id}`);
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("visiting /m/<id> directly renders the full page with link-preview metadata", async ({ page }) => {
  const item = manifest[0];
  const response = await page.goto(`/m/${item.id}`);
  expect(response?.status()).toBe(200);

  await expect(page).toHaveTitle(/ · Generation Feed$/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", new RegExp(item.model));
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/og\.jpg$/);
  await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "1200");
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
  await expect(page.getByRole("complementary").getByText(item.prompt, { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Next item" }).first()).toHaveAttribute("href", `/m/${manifest[1].id}`);
});

test("the static detail page works without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await serveFixtureMedia(page);
  await page.goto(`/m/${manifest[0].id}`);
  await expect(page.getByRole("complementary").getByText(manifest[0].prompt, { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Next item" }).first().click();
  await expect(page).toHaveURL(`/m/${manifest[1].id}`);
  await expect(page.getByRole("complementary").getByText(manifest[1].prompt, { exact: true })).toBeVisible();
  await context.close();
});

test("an unknown id gets a 404 page", async ({ page }) => {
  const response = await page.goto("/m/zzzzzzzzzz");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("link", { name: "Back to feed" })).toBeVisible();
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("the grid has 2 lanes, and tapping a card opens the detail view", async ({ page }) => {
    await page.goto("/");
    await waitForInteractiveFeed(page);
    const lanes = await page.$$eval('[role="listitem"]', (cards) =>
      new Set(cards.map((card) => Math.round(card.getBoundingClientRect().left))).size,
    );
    expect(lanes).toBe(2);

    await page.getByRole("listitem").first().getByRole("link").tap();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page).toHaveURL(`/m/${manifest[0].id}`);
  });
});
