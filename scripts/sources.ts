import { z } from "zod";
import { mediaItemSchema } from "../lib/manifest.ts";

const fields = mediaItemSchema.shape;

/**
 * One source file for scripts/ingest.ts. A sources.json lists them next to the files;
 * `file` is relative to that sources.json.
 */
export const sourceItemSchema = z.strictObject({
  file: z.string().min(1),
  kind: fields.kind,
  prompt: fields.prompt,
  model: fields.model,
  modelSlug: fields.modelSlug,
  createdAt: fields.createdAt,
  // The optional manifest fields (SPEC 4.2).
  collection: fields.collection,
  usedBy: fields.usedBy,
  cameraMove: fields.cameraMove,
  shot: fields.shot,
  pairId: fields.pairId,
  variant: fields.variant,
  ratioGroup: fields.ratioGroup,
  /** A video made from an image: that image's file, which ingest turns into `sourceId`. */
  sourceFile: z.string().min(1).optional(),
});

export const sourcesSchema = z.array(sourceItemSchema);

export type SourceItem = z.infer<typeof sourceItemSchema>;
