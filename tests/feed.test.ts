import { describe, expect, test } from "vitest";
import { encodeCursor, getFeedPage, MAX_PAGE_SIZE, PAGE_SIZE, parseLimit } from "@/lib/feed";
import { compareItems, type MediaItem } from "@/lib/manifest";
import { makeItem, makeVideo } from "./fixtures";

/** 25 items in feed order: every 5th is a video; items 10 and 11 share a timestamp. */
const items: MediaItem[] = Array.from({ length: 25 }, (_, n) => {
  const id = `item${String(n).padStart(6, "0")}`;
  const createdAt = new Date(Date.UTC(2026, 9, 1) - (n === 11 ? 10 : n) * 60_000).toISOString();
  return n % 5 === 0 ? makeVideo({ id, createdAt }) : makeItem({ id, createdAt, posterKey: `m/${id}/v1` });
}).sort(compareItems);

function allPages(filters = {}, limit = 7): MediaItem[] {
  const seen: MediaItem[] = [];
  let cursor: string | null = null;
  do {
    const page = getFeedPage(items, { filters, cursor, limit });
    seen.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor !== null);
  return seen;
}

describe("getFeedPage", () => {
  test("first page and total", () => {
    const page = getFeedPage(items, { limit: 10 });
    expect(page.items).toEqual(items.slice(0, 10));
    expect(page.total).toBe(25);
    expect(page.nextCursor).toBe(encodeCursor(items[9]));
  });

  test("walking the cursor returns every item exactly once, in order", () => {
    expect(allPages().map((item) => item.id)).toEqual(items.map((item) => item.id));
  });

  test("items with the same timestamp are neither skipped nor repeated", () => {
    // With 11 per page, the first page ends between the two items that share a timestamp.
    const firstPage = getFeedPage(items, { limit: 11 }).items;
    expect(firstPage[10].createdAt).toBe(items[11].createdAt);
    expect(allPages({}, 11).map((item) => item.id)).toEqual(items.map((item) => item.id));
  });

  test("filters apply before paging, and total counts matches", () => {
    const videos = allPages({ kind: "video" }, 2);
    expect(videos).toHaveLength(5);
    expect(videos.every((item) => item.kind === "video")).toBe(true);
    expect(getFeedPage(items, { filters: { kind: "video" } }).total).toBe(5);
  });

  test("the last page has no next cursor", () => {
    expect(getFeedPage(items, { limit: 100 }).nextCursor).toBeNull();
  });

  test("an invalid cursor is ignored and returns the first page", () => {
    expect(getFeedPage(items, { cursor: "not-a-cursor", limit: 3 }).items).toEqual(items.slice(0, 3));
  });

  test("a cursor past the end returns an empty page", () => {
    const last = items[items.length - 1];
    expect(getFeedPage(items, { cursor: encodeCursor(last) })).toEqual({ items: [], nextCursor: null, total: 25 });
  });
});

describe("parseLimit", () => {
  test("keeps whole numbers in range and falls back otherwise", () => {
    expect(parseLimit("12")).toBe(12);
    expect(parseLimit("500")).toBe(MAX_PAGE_SIZE);
    expect(parseLimit(null)).toBe(PAGE_SIZE);
    expect(parseLimit("0")).toBe(PAGE_SIZE);
    expect(parseLimit("2.5")).toBe(PAGE_SIZE);
    expect(parseLimit("abc")).toBe(PAGE_SIZE);
  });
});
