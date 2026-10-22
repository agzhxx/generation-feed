import { matchesFilters, type FeedFilters } from "./filters.ts";
import type { MediaItem } from "./manifest.ts";

export const PAGE_SIZE = 40;
export const MAX_PAGE_SIZE = 100;

export interface FeedPage {
  items: MediaItem[];
  /** Send back as `cursor` to get the next page; null on the last page. */
  nextCursor: string | null;
  /** Items that match the filters, across all pages. */
  total: number;
}

interface Cursor {
  time: number;
  id: string;
}

/**
 * A cursor names the last item seen by its time and id. Feed order is newest first, then by
 * id (lib/manifest.ts compareItems), so "everything after the cursor" never skips or repeats
 * an item, even if the manifest changed between two requests.
 */
export function encodeCursor(item: MediaItem): string {
  return `${Date.parse(item.createdAt).toString(36)}.${item.id}`;
}

function decodeCursor(cursor: string): Cursor | null {
  const match = /^([0-9a-z]{1,12})\.([0-9a-v]{10})$/.exec(cursor);
  if (match === null) return null;
  const time = parseInt(match[1], 36);
  return Number.isSafeInteger(time) ? { time, id: match[2] } : null;
}

function isAfter(item: MediaItem, cursor: Cursor): boolean {
  const time = Date.parse(item.createdAt);
  return time < cursor.time || (time === cursor.time && item.id > cursor.id);
}

/** A page size from the URL: a whole number from 1 to MAX_PAGE_SIZE, else PAGE_SIZE. */
export function parseLimit(value: string | null): number {
  const limit = Number(value);
  return value !== null && Number.isInteger(limit) && limit >= 1 ? Math.min(limit, MAX_PAGE_SIZE) : PAGE_SIZE;
}

/**
 * One page of the feed. `items` must be in feed order. An invalid cursor is ignored (the first
 * page comes back), like every other invalid parameter.
 */
export function getFeedPage(
  items: readonly MediaItem[],
  { filters = {}, cursor = null, limit = PAGE_SIZE }: { filters?: FeedFilters; cursor?: string | null; limit?: number } = {},
): FeedPage {
  const matching = items.filter((item) => matchesFilters(item, filters));
  const after = cursor === null ? null : decodeCursor(cursor);
  const found = after === null ? 0 : matching.findIndex((item) => isAfter(item, after));
  const start = found === -1 ? matching.length : found;
  const page = matching.slice(start, start + limit);
  const last = page[page.length - 1];
  const hasMore = start + page.length < matching.length;
  return {
    items: page,
    nextCursor: hasMore && last !== undefined ? encodeCursor(last) : null,
    total: matching.length,
  };
}
