"use client";

import { useSyncExternalStore } from "react";
import { WifiOffIcon } from "@/components/icons";

const PRIMARY_BUTTON =
  "inline-flex h-control items-center rounded-control bg-accent px-4 text-sm font-medium text-on-accent outline-focus transition-colors duration-(--dur-fast) hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2";

/** Nothing matches the filters (spec 3.4). */
export function NoResults({ q, onClear }: { q: string | undefined; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center px-4 pt-18 text-center">
      <h2 className="text-lg font-semibold">{q === undefined ? "No results" : `No results for “${q}”`}</h2>
      <p className="mt-2 max-w-sm text-fg-muted">
        Nothing matches these filters. Try another word, or clear the filters to see everything.
      </p>
      <button type="button" onClick={onClear} className={`mt-5 ${PRIMARY_BUTTON}`}>
        Clear filters
      </button>
    </div>
  );
}

/** A page of results failed to load: an inline row after the last card (spec 3.4). */
export function LoadError({ title, onRetry }: { title: string; onRetry: () => void }) {
  return (
    <div role="alert" className="mx-1 my-4 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card bg-surface p-4">
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-fg-muted">Check your connection, then try again.</p>
      </div>
      <button type="button" onClick={onRetry} className={PRIMARY_BUTTON}>
        Retry
      </button>
    </div>
  );
}

function subscribeOnline(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

const readOnline = () => navigator.onLine;
/** The server can't know; it renders no banner. */
const serverOnline = () => true;

/**
 * "You're offline" while the browser has no connection (spec 3.4). The live region is always in
 * the page, so screen readers announce the message when it appears.
 */
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribeOnline, readOnline, serverOnline);
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(16px+env(safe-area-inset-bottom))] z-20 flex justify-center px-4"
    >
      {!online && (
        <p className="flex h-10 items-center gap-2 rounded-pill bg-surface-raised pr-4 pl-3 text-sm shadow-popover">
          <span className="text-fg-muted">
            <WifiOffIcon />
          </span>
          You&apos;re offline. Showing what&apos;s already loaded.
        </p>
      )}
    </div>
  );
}
