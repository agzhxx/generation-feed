"use client";

import { memo, useEffect, useRef, useState, type ReactNode } from "react";
import type { MediaItem } from "@/lib/manifest";
import type { MediaUrls } from "@/lib/media-urls";
import { thumbHashDataUrl } from "@/lib/thumbhash";

/** How long the pointer rests on a video card before its preview plays (spec 3.1). */
const HOVER_INTENT_MS = 100;
/** Width of the plain <img> fallback when the browser takes neither <source>. */
const FALLBACK_WIDTH = 640;

/** "high": the LCP candidate. "eager": the rest of the first row. "lazy": everything else. */
export type PosterPriority = "high" | "eager" | "lazy";

export interface MediaCardProps {
  item: MediaItem;
  href: string;
  urls: MediaUrls;
  /** `sizes` for the poster srcset. */
  sizes: string;
  priority: PosterPriority;
  /** Renders a video's preview over its poster; `active` is true while it should play. */
  renderPreview?: (item: MediaItem, active: boolean) => ReactNode;
}

/**
 * One feed card: a link that fills its slot, with the ThumbHash blur, the poster, the video
 * preview and the badges stacked inside. No Next.js imports, no data fetching and no fixed
 * URLs, so it can move to the UI kit as is (spec 4.12). The grid sizes and positions it.
 */
export const MediaCard = memo(function MediaCard({ item, href, urls, sizes, priority, renderPreview }: MediaCardProps) {
  const isVideo = item.kind === "video";
  const [loaded, setLoaded] = useState(false);
  const [active, setActive] = useState(false);
  const intentTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(intentTimer.current), []);

  function startIntent(pointerType: string): void {
    // Touch gets center-of-screen autoplay in M3; here only a resting pointer plays.
    if (!isVideo || renderPreview === undefined || pointerType === "touch") return;
    window.clearTimeout(intentTimer.current);
    intentTimer.current = window.setTimeout(() => setActive(true), HOVER_INTENT_MS);
  }

  function stopIntent(): void {
    window.clearTimeout(intentTimer.current);
    setActive(false);
  }

  const fades = priority === "lazy";
  const seconds = Math.round(item.durationSec ?? 0);
  const label = isVideo
    ? `${item.prompt}. Video, ${seconds} seconds, ${item.model}, AI-generated.`
    : `${item.prompt}. Image, ${item.model}, AI-generated.`;

  return (
    <a
      href={href}
      onPointerEnter={(event) => startIntent(event.pointerType)}
      onPointerLeave={stopIntent}
      className="relative block size-full overflow-hidden rounded-card bg-skeleton text-fg outline-focus hover:outline-2 hover:outline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <img
        src={thumbHashDataUrl(item.thumbhash)}
        alt=""
        aria-hidden="true"
        data-placeholder=""
        className="absolute inset-0 size-full object-cover"
      />
      <picture>
        <source type="image/avif" srcSet={urls.posterSrcSet(item, "avif")} sizes={sizes} />
        <source type="image/webp" srcSet={urls.posterSrcSet(item, "webp")} sizes={sizes} />
        <img
          ref={(img) => {
            // A cached poster can finish loading before React attaches onLoad.
            if (img?.complete && img.naturalWidth > 0) setLoaded(true);
          }}
          src={urls.poster(item, FALLBACK_WIDTH, "webp")}
          alt=""
          loading={priority === "lazy" ? "lazy" : "eager"}
          fetchPriority={priority === "high" ? "high" : "auto"}
          decoding="async"
          onLoad={() => setLoaded(true)}
          className={`absolute inset-0 size-full object-cover ${
            fades ? `transition-opacity duration-(--dur-base) ease-out ${loaded ? "opacity-100" : "opacity-0"}` : ""
          }`}
        />
      </picture>
      {isVideo && renderPreview?.(item, active)}
      <span className="sr-only">{label}</span>
      <span aria-hidden="true" className="absolute top-2 left-2 flex gap-1">
        <Badge className="font-semibold tracking-label uppercase">AI</Badge>
        {isVideo && <Badge className="font-medium tabular-nums">Video · {seconds}s</Badge>}
      </span>
      <span aria-hidden="true" className="absolute bottom-2 left-2">
        <Badge className="font-medium">{item.model}</Badge>
      </span>
    </a>
  );
});

function Badge({ className, children }: { className: string; children: ReactNode }) {
  return <span className={`block h-5 rounded-badge bg-scrim px-1.5 text-2xs leading-5 ${className}`}>{children}</span>;
}
