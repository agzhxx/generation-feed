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
});

export const sourcesSchema = z.array(sourceItemSchema);

export type SourceItem = z.infer<typeof sourceItemSchema>;
