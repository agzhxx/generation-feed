import { z } from "zod";
import { COLLECTIONS, type Collection } from "./collections.ts";
import { SLUG_PATTERN } from "./filters.ts";

/** 50 bits of the source file's SHA-256 in base32hex: short, URL-safe and stable. */
const ID_PATTERN = /^[0-9a-v]{10}$/;

const slug = z.string().regex(SLUG_PATTERN);

/** Optional fields that only make sense in one collection. */
const ONLY_IN = { cameraMove: "camera-moves", shot: "story", pairId: "pairs", variant: "pairs", ratioGroup: "ratios" } as const;

export const mediaItemSchema = z
  .strictObject({
    id: z.string().regex(ID_PATTERN),
    kind: z.enum(["image", "video"]),
    /** Source pixels. */
    width: z.int().positive(),
    height: z.int().positive(),
    thumbhash: z.base64(),
    /** R2 key prefix of the poster; URLs add width and format (lib/media-urls.ts). */
    posterKey: z.string().min(1),
    /** Video only: ~2.5 s muted loop. */
    previewKey: z.string().min(1).optional(),
    /** Video only: full clip for the detail view. */
    videoKey: z.string().min(1).optional(),
    durationSec: z.number().positive().optional(),
    prompt: z.string().min(1),
    /** Display name, e.g. "Soul 2". */
    model: z.string().min(1),
    /** For URLs, e.g. "soul-2". */
    modelSlug: z.string().regex(SLUG_PATTERN),
    createdAt: z.iso.datetime(),
    // Optional, from M5, so later projects can find media through /api/media.
    collection: z.enum(COLLECTIONS).optional(),
    /** Projects that use the item, e.g. ["feed", "kit"]. */
    usedBy: z.array(slug).min(1).optional(),
    /** A video made from an image: that image's id. */
    sourceId: z.string().regex(ID_PATTERN).optional(),
    /** camera-moves only, e.g. "crash-zoom". */
    cameraMove: slug.optional(),
    /** story only, e.g. "03-closeup". */
    shot: slug.optional(),
    /** pairs only, e.g. "p07". */
    pairId: slug.optional(),
    variant: z.enum(["draft", "final", "day", "night"]).optional(),
    /** ratios only, e.g. "r03". */
    ratioGroup: slug.optional(),
  })
  .superRefine((item, ctx) => {
    if (item.sourceId !== undefined && item.kind !== "video") {
      ctx.addIssue({ code: "custom", path: ["sourceId"], message: "Only a video has a source image" });
    }
    for (const [field, collection] of Object.entries(ONLY_IN) as [keyof typeof ONLY_IN, Collection][]) {
      if (item[field] !== undefined && item.collection !== collection) {
        ctx.addIssue({ code: "custom", path: [field], message: `${field} belongs to ${collection} items` });
      }
    }
    const videoFields = ["previewKey", "videoKey", "durationSec"] as const;
    for (const field of videoFields) {
      const present = item[field] !== undefined;
      if (item.kind === "video" && !present) {
        ctx.addIssue({ code: "custom", path: [field], message: `A video needs ${field}` });
      }
      if (item.kind === "image" && present) {
        ctx.addIssue({ code: "custom", path: [field], message: `An image can't have ${field}` });
      }
    }
  });

export type MediaItem = z.infer<typeof mediaItemSchema>;

export const manifestSchema = z.array(mediaItemSchema).superRefine((items, ctx) => {
  const seen = new Set<string>();
  items.forEach((item, index) => {
    if (seen.has(item.id)) {
      ctx.addIssue({ code: "custom", path: [index, "id"], message: `Duplicate id ${item.id}` });
    }
    seen.add(item.id);
  });
  const kinds = new Map(items.map((item) => [item.id, item.kind]));
  items.forEach((item, index) => {
    if (item.sourceId !== undefined && kinds.get(item.sourceId) !== "image") {
      ctx.addIssue({ code: "custom", path: [index, "sourceId"], message: `${item.sourceId} is not an image in the manifest` });
    }
  });
});

/** Feed order: newest first, then by id so the order never changes between runs. */
export function compareItems(a: MediaItem, b: MediaItem): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
