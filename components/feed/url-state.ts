"use client";

import { useMemo, useSyncExternalStore } from "react";
import { FILTER_PARAMS, filtersToParams, parseFilters, type FeedFilters } from "@/lib/filters";

/*
 * The address bar as a tiny store. Next's useSearchParams would make the prerendered feed wait
 * for the browser (it needs a Suspense boundary, and the server would send its fallback instead
 * of the first page). This store lets the server render the feed without filters; right after
 * hydration the client reads the real address and applies its filters.
 */

const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("popstate", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
}

// The feed's query string. The detail view puts /m/<id> in the address bar while the feed stays
// underneath with the filters it had, so the last feed address is remembered.
let feedSearch = "";

function readFeedSearch(): string {
  if (window.location.pathname === "/") feedSearch = window.location.search;
  return feedSearch;
}

const serverSearch = () => "";

/** The filters in the address bar (spec 3.3). None on the server and during hydration. */
export function useFeedFilters(): FeedFilters {
  const search = useSyncExternalStore(subscribe, readFeedSearch, serverSearch);
  return useMemo(() => parseFilters(new URLSearchParams(search)), [search]);
}

/** The feed's address for some filters, keeping params that aren't filters (like ?perf=1). */
export function feedHref(filters: FeedFilters, currentSearch: string): string {
  const params = filtersToParams(filters);
  for (const [name, value] of new URLSearchParams(currentSearch)) {
    if (!(FILTER_PARAMS as readonly string[]).includes(name)) params.append(name, value);
  }
  const search = params.toString();
  return search === "" ? "/" : `/?${search}`;
}

/** Changes the filters in place: no new history entry, so Back still leaves the page. */
export function replaceFilters(filters: FeedFilters): void {
  window.history.replaceState(null, "", feedHref(filters, window.location.search));
  // pushState and replaceState fire no event of their own.
  for (const listener of listeners) listener();
}
