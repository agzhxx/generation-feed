import type { ReactNode } from "react";
import type { GetMediaUrl } from "@/components/ui/media-card/media-card";
import type { MediaItem } from "@/lib/manifest";
import { MEDIA_ORIGINS, posterUrl, previewUrl } from "@/lib/media-urls";
import { recordFirstFrame } from "@/lib/preview-metrics";

// How the feed's items become the Genframe Kit's media cards (components/ui/media-card, installed
// from the Kit with `shadcn add`): their name, their URLs and their badges. MediaGrid takes these as
// props, so they're plain functions, the same object on every render.

/** A feed item as a card shows it. The Kit's cards are named by `alt`. */
export type FeedCardItem = MediaItem & { alt: string };

/** "A neon street… Video, 5 seconds, Kling 2.5, AI-generated." The badges say the same to the eye. */
export function cardLabel(item: MediaItem): string {
  return item.kind === "video"
    ? `${item.prompt}. Video, ${Math.round(item.durationSec ?? 0)} seconds, ${item.model}, AI-generated.`
    : `${item.prompt}. Image, ${item.model}, AI-generated.`;
}

export function toCardItem(item: MediaItem): FeedCardItem {
  return { ...item, alt: cardLabel(item) };
}

/** Posters in AVIF and WebP from the site's own address, previews from the bucket (lib/media-urls.ts). */
export const getMediaUrl: GetMediaUrl<FeedCardItem> = (item, request) => {
  if (request.type === "preview") return previewUrl(MEDIA_ORIGINS.videos, item);
  return request.format === "avif" || request.format === "webp"
    ? posterUrl(MEDIA_ORIGINS.posters, item, request.width, request.format)
    : undefined;
};

/** Hover → first frame, for the perf overlay. */
export function onPreviewStart(_item: FeedCardItem, ms: number): void {
  recordFirstFrame(ms);
}

/** The "AI" label and a video's length at the top, the model at the bottom. */
export function feedBadges(item: FeedCardItem): ReactNode {
  return (
    <>
      <span aria-hidden="true" className="absolute top-2 left-2 flex gap-1">
        <Badge className="font-semibold tracking-label uppercase">AI</Badge>
        {item.kind === "video" && (
          <Badge className="font-medium tabular-nums">Video · {Math.round(item.durationSec ?? 0)}s</Badge>
        )}
      </span>
      <span aria-hidden="true" className="absolute bottom-2 left-2">
        <Badge className="font-medium">{item.model}</Badge>
      </span>
    </>
  );
}

function Badge({ className, children }: { className: string; children: ReactNode }) {
  return <span className={`block h-5 rounded-badge bg-scrim px-1.5 text-2xs leading-5 ${className}`}>{children}</span>;
}
