"use client";

import { useEffect } from "react";

/** Keys a typing or media control already uses. */
const OWN_KEYS = "input, textarea, select, video, [contenteditable]";

/**
 * Keyboard browsing on the static detail page: ← and → load the neighbours, Esc goes back to the
 * feed. The links on the page do the same without JavaScript.
 */
export function DetailKeys({ previousHref, nextHref }: { previousHref: string | null; nextHref: string | null }) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.target instanceof Element && event.target.closest(OWN_KEYS) !== null) return;
      const href =
        event.key === "ArrowLeft" ? previousHref : event.key === "ArrowRight" ? nextHref : event.key === "Escape" ? "/" : null;
      if (href !== null) window.location.assign(href);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previousHref, nextHref]);
  return null;
}
