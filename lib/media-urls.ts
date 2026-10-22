import type { MediaItem } from "./manifest.ts";

/** Poster widths that scripts/ingest.ts makes, in AVIF and WebP. */
export const POSTER_WIDTHS = [320, 480, 640, 960, 1280, 1920] as const;
export type PosterFormat = "avif" | "webp";

/** Width of the JPEG used for link previews (Open Graph). */
export const OG_IMAGE_WIDTH = 1200;

/** `sizes` for grid posters: a lane is 1/2, 1/3, 1/4 or 1/5 of the viewport. */
export const GRID_POSTER_SIZES =
  "(max-width: 639px) 50vw, (max-width: 1023px) 33vw, (max-width: 1439px) 25vw, 20vw";

/** Poster widths that exist for a source: never upscaled, but the smallest always exists. */
export function posterWidths(sourceWidth: number): number[] {
  const widths = POSTER_WIDTHS.filter((width) => width <= sourceWidth);
  return widths.length > 0 ? widths : [POSTER_WIDTHS[0]];
}

// Storage keys. scripts/ingest.ts writes files under these names; the URLs below read them.

export function posterFileKey(posterKey: string, width: number, format: PosterFormat): string {
  return `${posterKey}/${width}.${format}`;
}

export function ogImageKey(posterKey: string): string {
  return `${posterKey}/og.jpg`;
}

// URLs. `origin` is the public media origin, e.g. NEXT_PUBLIC_MEDIA_ORIGIN.

export function mediaUrl(origin: string, key: string): string {
  return `${origin.replace(/\/+$/, "")}/${key}`;
}

/** The smallest poster at least `width` wide, or the largest one there is. */
export function posterUrl(
  origin: string,
  item: MediaItem,
  width: number,
  format: PosterFormat,
): string {
  const widths = posterWidths(item.width);
  const chosen = widths.find((candidate) => candidate >= width) ?? widths[widths.length - 1];
  return mediaUrl(origin, posterFileKey(item.posterKey, chosen, format));
}

export function posterSrcSet(origin: string, item: MediaItem, format: PosterFormat): string {
  return posterWidths(item.width)
    .map((width) => `${mediaUrl(origin, posterFileKey(item.posterKey, width, format))} ${width}w`)
    .join(", ");
}

export function ogImageUrl(origin: string, item: MediaItem): string {
  return mediaUrl(origin, ogImageKey(item.posterKey));
}

export function previewUrl(origin: string, item: MediaItem): string | undefined {
  return item.previewKey === undefined ? undefined : mediaUrl(origin, item.previewKey);
}

export function videoUrl(origin: string, item: MediaItem): string | undefined {
  return item.videoKey === undefined ? undefined : mediaUrl(origin, item.videoKey);
}

/**
 * The URLs a media card needs, bound to one origin. Cards take this as a prop, so they hold
 * no hard-coded origin and can move to the UI kit unchanged (spec 4.12).
 */
export interface MediaUrls {
  poster(item: MediaItem, width: number, format: PosterFormat): string;
  posterSrcSet(item: MediaItem, format: PosterFormat): string;
  preview(item: MediaItem): string | undefined;
}

export function createMediaUrls(origin: string): MediaUrls {
  return {
    poster: (item, width, format) => posterUrl(origin, item, width, format),
    posterSrcSet: (item, format) => posterSrcSet(origin, item, format),
    preview: (item) => previewUrl(origin, item),
  };
}
