import { z } from "zod";
import { SLUG_PATTERN } from "./filters.ts";

/** 50 bits of the source file's SHA-256 in base32hex: short, URL-safe and stable. */
const ID_PATTERN = /^[0-9a-v]{10}$/;

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
  })
  .superRefine((item, ctx) => {
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
});

/** Feed order: newest first, then by id so the order never changes between runs. */
export function compareItems(a: MediaItem, b: MediaItem): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
