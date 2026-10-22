"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState, type RefObject } from "react";
import { flushSync } from "react-dom";
import type { DetailOverlay } from "@/components/detail/DetailOverlay";
import type { MediaItem } from "@/lib/manifest";
import type { MediaGridHandle } from "@/components/ui/media-grid/media-grid";

/** The view-transition-name the clicked card and the overlay's media share (spec 4.8). */
const TRANSITION_NAME = "detail-media";
const DETAIL_PATH = /^\/m\/([0-9a-v]{10})$/;
/** Load the next page when the overlay is this close to the last loaded item. */
const LOAD_AHEAD = 3;
/** Longest wait for the overlay's placeholder images to decode before the zoom starts. */
const DECODE_WAIT_MS = 100;

type OverlayComponent = typeof DetailOverlay;

let overlayCode: Promise<OverlayComponent> | null = null;

/** The overlay is its own chunk, fetched once; a failed fetch (offline) may be tried again. */
function loadOverlay(): Promise<OverlayComponent> {
  overlayCode ??= import("@/components/detail/DetailOverlay").then(
    (module) => module.DetailOverlay,
    (error: unknown) => {
      overlayCode = null;
      throw error;
    },
  );
  return overlayCode;
}

/** View transitions are skipped where unsupported and for reduced motion (spec 3.2). */
function canMorph(): boolean {
  return (
    typeof document.startViewTransition === "function" &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Resolves once these images can be drawn, or after `ms`, whichever comes first. */
function decoded(images: Iterable<HTMLImageElement>, ms: number): Promise<unknown> {
  const decodes = [...images].map((image) => image.decode().catch(() => undefined));
  return Promise.race([Promise.all(decodes), new Promise((resolve) => setTimeout(resolve, ms))]);
}

interface OpenItem {
  id: string;
  /** The grid poster already on screen; the overlay shows it until the large one loads. */
  lowSrc?: string;
}

interface UseDetailOptions {
  items: readonly MediaItem[];
  total: number;
  hasMore: boolean;
  loadMore: () => void;
  autoPlay: boolean;
  grid: RefObject<MediaGridHandle | null>;
}

/**
 * The detail overlay's state (spec 4.8). Local state says which item is open; the address bar
 * follows it: opening pushes /m/<id>, ← and → replace it, and closing goes back one entry, so
 * Back, Esc and the Close button all close the same way and the history stays clean. Opening
 * and closing run inside a view transition, so the card's media zooms into the overlay and back.
 */
export function useDetail({ items, total, hasMore, loadMore, autoPlay, grid }: UseDetailOptions) {
  const [Overlay, setOverlay] = useState<OverlayComponent | null>(null);
  const [open, setOpen] = useState<OpenItem | null>(null);
  const closing = useRef(false);

  // Fetch the overlay's code once the page is idle, so the first click opens it at once.
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      loadOverlay().then(
        (component) => {
          if (!cancelled) setOverlay(() => component);
        },
        () => {}, // Tried again on the first click.
      );
    // Safari has no requestIdleCallback.
    if (typeof (window as Partial<Window>).requestIdleCallback === "function") {
      const handle = window.requestIdleCallback(load, { timeout: 2000 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(handle);
      };
    }
    const timer = window.setTimeout(load, 1000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  const openItem = useCallback((item: MediaItem, link: HTMLAnchorElement | HTMLButtonElement) => {
    const lowSrc = link.querySelector<HTMLImageElement>("picture img")?.currentSrc || undefined;
    loadOverlay().then(
      (component) => {
        closing.current = false;
        window.history.pushState({ detail: item.id }, "", `/m/${item.id}`);
        const show = () => {
          flushSync(() => {
            setOverlay(() => component);
            setOpen({ id: item.id, lowSrc });
          });
        };
        if (!canMorph()) {
          show();
          return;
        }
        // Old frame: the card carries the name. New frame: the overlay's figure does.
        link.style.viewTransitionName = TRANSITION_NAME;
        document.startViewTransition(async () => {
          link.style.viewTransitionName = "";
          show();
          const placeholders = document.querySelectorAll<HTMLImageElement>("dialog img[data-placeholder]");
          await decoded(placeholders, DECODE_WAIT_MS);
        });
      },
      // No overlay code (offline before it loaded): follow the link instead.
      () => {
        if (link instanceof HTMLAnchorElement) window.location.assign(link.href);
      },
    );
  }, []);

  const index = open === null ? -1 : items.findIndex((item) => item.id === open.id);

  // Stepping near the end of what's loaded fetches the next page, so → keeps working.
  useEffect(() => {
    if (index !== -1 && hasMore && index >= items.length - LOAD_AHEAD) loadMore();
  }, [index, hasMore, items.length, loadMore]);

  const step = useCallback((item: MediaItem) => {
    window.history.replaceState({ detail: item.id }, "", `/m/${item.id}`);
    setOpen({ id: item.id });
  }, []);

  const requestClose = useCallback(() => {
    // Esc twice in a row must not go back two entries.
    if (closing.current) return;
    closing.current = true;
    window.history.back();
  }, []);

  /** Closes the overlay, brings the card you ended on into view and focuses it (spec 3.2). */
  const close = useEffectEvent(() => {
    const endedOn = index;
    const update = () => {
      flushSync(() => setOpen(null));
      const link = endedOn === -1 ? null : (grid.current?.reveal(endedOn) ?? null);
      link?.focus({ preventScroll: true });
      return link;
    };
    if (!canMorph()) {
      update();
      return;
    }
    let link: HTMLElement | null = null;
    const transition = document.startViewTransition(() => {
      link = update();
      if (link !== null) link.style.viewTransitionName = TRANSITION_NAME;
    });
    void transition.finished.finally(() => {
      if (link !== null) link.style.viewTransitionName = "";
    });
  });

  const onPopState = useEffectEvent(() => {
    const id = DETAIL_PATH.exec(window.location.pathname)?.[1] ?? null;
    if (id === null) {
      if (open !== null) close();
      return;
    }
    if (open?.id === id) return;
    // Forward onto a detail address again: reopen it if the feed has the item, else load its page.
    if (Overlay !== null && items.some((item) => item.id === id)) {
      closing.current = false;
      flushSync(() => setOpen({ id }));
    } else {
      window.location.reload();
    }
  });

  useEffect(() => {
    const listener = () => onPopState();
    window.addEventListener("popstate", listener);
    return () => window.removeEventListener("popstate", listener);
  }, []);

  const overlay =
    Overlay !== null && open !== null && index !== -1 ? (
      <Overlay
        item={items[index]}
        position={index + 1}
        total={total}
        previous={items[index - 1] ?? null}
        next={items[index + 1] ?? null}
        lowSrc={open.lowSrc}
        autoPlay={autoPlay}
        transitionName={TRANSITION_NAME}
        onStep={step}
        onClose={requestClose}
      />
    ) : null;

  return { openItem, isOpen: open !== null, overlay };
}
