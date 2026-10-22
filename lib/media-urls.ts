import type { MediaItem } from "./manifest.ts";

/** Poster widths that scripts/ingest.ts makes, in AVIF and WebP. */
export const POSTER_WIDTHS = [320, 480, 640, 960, 1280, 1920] as const;
export type PosterFormat = "avif" | "webp";

/** Width of the JPEG used for link previews (Open Graph). */
export const OG_IMAGE_WIDTH = 1200;

/** `sizes` for grid posters: a lane is 1/2, 1/3, 1/4 or 1/5 of the viewport. */
export const GRID_POSTER_SIZES =
  "(max-width: 639px) 50vw, (max-width: 1023px) 33vw, (max-width: 1439px) 25vw, 20vw";

/** With Save-Data on: half of that, so the browser picks posters about half as wide (spec 3.4). */
export const GRID_POSTER_SIZES_SAVE_DATA =
  "(max-width: 639px) 25vw, (max-width: 1023px) 17vw, (max-width: 1439px) 13vw, 10vw";

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

/** The original at full quality, for later projects: an image as WebP, a video as delivered. */
export function originalKey(item: Pick<MediaItem, "id" | "kind">): string {
  return `originals/${item.id}.${item.kind === "image" ? "webp" : "mp4"}`;
}

/** Where pages load media from: posters and videos can come from different origins. */
export interface MediaOrigins {
  posters: string;
  videos: string;
}

/** The R2 bucket's public origin, e.g. its r2.dev address. */
export const BUCKET_ORIGIN = process.env.NEXT_PUBLIC_MEDIA_ORIGIN ?? "";

/**
 * Posters load from the site's own address: next.config.ts forwards them to the bucket and
 * Vercel's CDN caches them, so the first screen needs no second connection. Videos load from the
 * bucket itself: browsers ask for a video in ranges, and Vercel's CDN would replay the answer to
 * one range for every request to that file.
 */
export const MEDIA_ORIGINS: MediaOrigins = { posters: "", videos: BUCKET_ORIGIN };

// URLs. `origin` is where the file is fetched from: one of MEDIA_ORIGINS, or BUCKET_ORIGIN.

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
