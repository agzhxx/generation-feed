import type { MediaItem } from "./manifest.ts";

/** Model slugs in URLs, e.g. "soul-2". */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const MAX_QUERY_LENGTH = 100;

/** Feed filters from the URL: `kind`, `model` (a slug) and `q` (words in the prompt). */
export interface FeedFilters {
  kind?: MediaItem["kind"];
  model?: string;
  q?: string;
}

/** Reads filters from URL params. Invalid values are dropped, never thrown (spec 3.3). */
export function parseFilters(params: URLSearchParams): FeedFilters {
  const filters: FeedFilters = {};
  const kind = params.get("kind");
  if (kind === "image" || kind === "video") filters.kind = kind;
  const model = params.get("model");
  if (model !== null && SLUG_PATTERN.test(model)) filters.model = model;
  const q = params.get("q")?.trim().slice(0, MAX_QUERY_LENGTH);
  if (q) filters.q = q;
  return filters;
}

/** An item matches when it fits every filter; `q` needs every word somewhere in the prompt. */
export function matchesFilters(item: MediaItem, filters: FeedFilters): boolean {
  if (filters.kind !== undefined && item.kind !== filters.kind) return false;
  if (filters.model !== undefined && item.modelSlug !== filters.model) return false;
  if (filters.q !== undefined) {
    const prompt = item.prompt.toLowerCase();
    return filters.q
      .toLowerCase()
      .split(/\s+/)
      .every((word) => prompt.includes(word));
  }
  return true;
}
