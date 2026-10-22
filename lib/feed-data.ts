import raw from "@/data/manifest.json";
import { manifestSchema, type MediaItem } from "./manifest.ts";

/** Every item, in feed order. Server only: it brings zod and the whole manifest along. */
export const feedItems: readonly MediaItem[] = manifestSchema.parse(raw);
