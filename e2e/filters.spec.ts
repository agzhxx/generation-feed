import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { matchesFilters, type FeedFilters } from "../lib/filters";
import { manifest, serveFixtureMedia, waitForInteractiveFeed } from "./helpers";

test.beforeEach(async ({ page }) => {
  await serveFixtureMedia(page);
});

/** Waits until the header shows the result count for these filters: the new results are in. */
async function expectResultsFor(page: Page, filters: FeedFilters): Promise<void> {
  const count = manifest.filter((item) => matchesFilters(item, filters)).length;
  await expect(page.locator("header [aria-live]")).toHaveText(`${count} results`);
}

function cardLabels(page: Page): Promise<string[]> {
  return page.getByRole("listitem").getByRole("link").allTextContents();
}

test("/?kind=video shows only videos; changing filters adds no history entries", async ({ page }) => {
  await page.goto("/?kind=video");
  await expect(page.getByRole("button", { name: "Videos" })).toHaveAttribute("aria-pressed", "true");
  await expectResultsFor(page, { kind: "video" });
  const labels = await cardLabels(page);
  expect(labels.length).toBeGreaterThan(0);
  expect(labels.every((label) => label.includes(". Video, "))).toBe(true);

  const entries = await page.evaluate(() => history.length);
  await page.getByRole("button", { name: "Images" }).click();
  await expect(page).toHaveURL("/?kind=image");
  await expectResultsFor(page, { kind: "image" });
  await page.getByRole("combobox", { name: "Model" }).selectOption({ label: "Grid Studio" });
  await expect(page).toHaveURL("/?kind=image&model=grid-studio");
  await page.getByRole("searchbox", { name: "Search prompts" }).fill("teal");
  await expect(page).toHaveURL("/?kind=image&model=grid-studio&q=teal");
  await expectResultsFor(page, { kind: "image", model: "grid-studio", q: "teal" });
  expect(await page.evaluate(() => history.length)).toBe(entries);

  const filtered = await cardLabels(page);
  expect(filtered.length).toBeGreaterThan(0);
  expect(filtered.every((label) => label.includes("teal") && label.includes("Grid Studio"))).toBe(true);
});

test("/?collection=story shows only that collection, and combines with the other filters", async ({ page }) => {
  await page.goto("/?collection=story");
  await waitForInteractiveFeed(page);
  const select = page.getByRole("combobox", { name: "Collection" });
  await expect(select).toHaveValue("story");
  await expectResultsFor(page, { collection: "story" });
  const storyIds = new Set(manifest.filter((item) => item.collection === "story").map((item) => item.id));
  const hrefs = await page.getByRole("listitem").getByRole("link").evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""));
  expect(hrefs.length).toBeGreaterThan(0);
  expect(hrefs.every((href) => storyIds.has(href.replace("/m/", "")))).toBe(true);

  await page.getByRole("button", { name: "Videos" }).click();
  await expect(page).toHaveURL("/?kind=video&collection=story");
  await expectResultsFor(page, { kind: "video", collection: "story" });
  await select.selectOption({ label: "All collections" });
  await expect(page).toHaveURL("/?kind=video");
  await expectResultsFor(page, { kind: "video" });
});

test("phones: the Filters button opens the pickers in a sheet, and focus comes back to it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await waitForInteractiveFeed(page);
  // The row holds the chips and the button; the pickers wait in the sheet.
  await expect(page.getByRole("combobox", { name: "Model" })).toBeHidden();
  const button = page.getByRole("button", { name: /^Filters/ });
  await button.click();
  const sheet = page.getByRole("dialog", { name: "Filters" });
  await sheet.getByRole("combobox", { name: "Collection" }).selectOption({ label: "Story" });
  await expect(page).toHaveURL("/?collection=story");
  await expectResultsFor(page, { collection: "story" });
  const count = manifest.filter((item) => item.collection === "story").length;
  await sheet.getByRole("button", { name: `Show ${count} results` }).click();
  await expect(sheet).toBeHidden();
  await expect(button).toBeFocused();
  await expect(button).toContainText("1");
});

test("an unknown collection in the URL is ignored", async ({ page }) => {
  await page.goto("/?collection=landscapes");
  await waitForInteractiveFeed(page);
  await expectResultsFor(page, {});
  await expect(page.getByRole("combobox", { name: "Collection" })).toHaveValue("");
});

test("/?q=zzzz shows the empty state, and Clear filters shows everything", async ({ page }) => {
  await page.goto("/?q=zzzz");
  await expect(page.getByRole("heading", { name: "No results for “zzzz”" })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("listitem").first()).toBeVisible();
  await expectResultsFor(page, {});
  await expect(page.getByRole("searchbox", { name: "Search prompts" })).toHaveValue("");
});

test("going offline shows the banner, and nothing crashes", async ({ page, context }) => {
  const crashes: string[] = [];
  page.on("pageerror", (error) => crashes.push(error.message));
  await page.goto("/");
  await expect(page.getByRole("listitem").first()).toBeVisible();

  await context.setOffline(true);
  const banner = page.getByText("You're offline. Showing what's already loaded.");
  await expect(banner).toBeVisible();
  // Scrolling to the end asks for the next page, which has to wait for the connection.
  await page.mouse.wheel(0, 6000);
  await page.waitForTimeout(500);
  await expect(page.getByRole("listitem").first()).toBeAttached();

  await context.setOffline(false);
  await expect(banner).toHaveCount(0);
  expect(crashes).toEqual([]);
});

/** Serious and critical axe findings, as "rule: how many nodes". */
async function seriousIssues(page: Page): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => `${violation.id}: ${violation.nodes.length}`);
}

test("axe finds no serious or critical issues on / or in the detail view", async ({ page }) => {
  await page.goto("/");
  await waitForInteractiveFeed(page);
  expect(await seriousIssues(page)).toEqual([]);

  await page.getByRole("listitem").first().getByRole("link").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await seriousIssues(page)).toEqual([]);

  await page.goto(`/m/${manifest[0].id}`);
  expect(await seriousIssues(page)).toEqual([]);
});
