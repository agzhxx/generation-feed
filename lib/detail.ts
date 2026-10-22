import type { MediaItem } from "./manifest.ts";

/** Ratios people recognise, so 1638 × 2048 reads "4:5" and not "819:1024". */
const NAMED_RATIOS = [
  [1, 1],
  [4, 5],
  [5, 4],
  [3, 4],
  [4, 3],
  [2, 3],
  [3, 2],
  [9, 16],
  [16, 9],
  [21, 9],
  [9, 21],
] as const;

/** Within 1 % of a named ratio counts as that ratio. */
const RATIO_TOLERANCE = 0.01;

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** "4:5" for 1638 × 2048; the exact reduced ratio when no named one is close. */
export function aspectLabel(width: number, height: number): string {
  const ratio = width / height;
  for (const [w, h] of NAMED_RATIOS) {
    if (Math.abs(ratio / (w / h) - 1) <= RATIO_TOLERANCE) return `${w}:${h}`;
  }
  const divisor = gcd(width, height);
  return `${width / divisor}:${height / divisor}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

/**
 * "14 Oct 2026". UTC, so server and browser always print the same day. Not Intl.DateTimeFormat:
 * creating one loads the browser's locale data, about 40 ms of start-up on a 4× slower CPU
 * (docs/PERF.md).
 */
export function formatCreated(isoDate: string): string {
  const date = new Date(isoDate);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** "Video · 5 s" or "Image". */
export function kindLabel(item: MediaItem): string {
  return item.kind === "video" ? `Video · ${Math.round(item.durationSec ?? 0)} s` : "Image";
}

/** At most `max` characters, cut at a word break when one is near, ending in "…". */
export function shorten(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const words = lastSpace > max / 2 ? cut.slice(0, lastSpace) : cut;
  return `${words.replace(/[\s,;:.]+$/, "")}…`;
}
