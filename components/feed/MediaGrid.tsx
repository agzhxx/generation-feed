"use client";

import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cardHeight, gridLayout, laneLeft } from "@/lib/layout";
import type { MediaItem } from "@/lib/manifest";
import type { MediaUrls } from "@/lib/media-urls";
import { MediaCard, type PosterPriority } from "./MediaCard";

/** Rows of cards kept above and below the screen: roughly one screen (spec 4.6). */
const OVERSCAN_ROWS = 4;
/** Ask for the next page this many cards before the end (spec 3.1). */
const LOAD_AHEAD = 20;

export interface MediaGridProps {
  items: readonly MediaItem[];
  /** All matching items, loaded or not: screen readers hear "item 5 of 340". */
  total: number;
  urls: MediaUrls;
  /** `sizes` for the poster srcset; must match the lanes (lib/media-urls GRID_POSTER_SIZES). */
  sizes: string;
  getHref: (item: MediaItem) => string;
  label: string;
  hasMore: boolean;
  onEndReached: () => void;
  renderPreview?: (item: MediaItem, active: boolean) => ReactNode;
}

/**
 * Virtualized masonry: only cards near the screen are in the DOM, each card's height comes
 * from its aspect ratio (no DOM measuring), and every card goes into the shortest lane.
 * Window scrolling, so the page scrolls normally. Like MediaCard, it has no Next.js imports
 * and gets its data through props (spec 4.12).
 */
export function MediaGrid({ items, total, urls, sizes, getHref, label, hasMore, onEndReached, renderPreview }: MediaGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [scrollMargin, setScrollMargin] = useState(0);

  // Width and page offset decide everything else. Measured before paint, and again on resize.
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (grid === null) return;
    const update = () => {
      setWidth(grid.clientWidth);
      setScrollMargin(grid.getBoundingClientRect().top + window.scrollY);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  const layout = gridLayout(width);
  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: (index) => cardHeight(layout.laneWidth, items[index].width, items[index].height),
    getItemKey: (index) => items[index].id,
    lanes: layout.lanes,
    gap: layout.gap,
    paddingStart: layout.gap,
    paddingEnd: layout.gap,
    scrollMargin,
    overscan: OVERSCAN_ROWS,
    // Our sizes are exact, so lanes can be assigned without measuring anything.
    laneAssignmentMode: "estimate",
    enabled: width > 0,
  });

  // A new lane width changes every card's height.
  useEffect(() => {
    virtualizer.measure();
  }, [virtualizer, layout.laneWidth]);

  const virtualItems = virtualizer.getVirtualItems();
  const lastRendered = virtualItems.length > 0 ? virtualItems[virtualItems.length - 1].index : -1;
  useEffect(() => {
    if (hasMore && lastRendered >= items.length - LOAD_AHEAD) onEndReached();
  }, [hasMore, lastRendered, items.length, onEndReached]);

  return (
    <div
      ref={gridRef}
      role="list"
      aria-label={label}
      className="relative w-full"
      // Until the width is known, hold one screen of space so nothing below jumps.
      style={{ height: width > 0 ? virtualizer.getTotalSize() : "100dvh" }}
    >
      {virtualItems.map((virtualItem) => {
        const item = items[virtualItem.index];
        const priority: PosterPriority =
          virtualItem.index === 0 ? "high" : virtualItem.index < layout.lanes ? "eager" : "lazy";
        return (
          <div
            key={virtualItem.key}
            role="listitem"
            aria-posinset={virtualItem.index + 1}
            aria-setsize={total}
            className="absolute top-0 left-0 focus-within:z-1 hover:z-1"
            style={{
              width: layout.laneWidth,
              height: virtualItem.size,
              transform: `translate(${laneLeft(layout, virtualItem.lane)}px, ${virtualItem.start - scrollMargin}px)`,
            }}
          >
            <MediaCard
              item={item}
              href={getHref(item)}
              urls={urls}
              sizes={sizes}
              priority={priority}
              renderPreview={renderPreview}
            />
          </div>
        );
      })}
    </div>
  );
}
