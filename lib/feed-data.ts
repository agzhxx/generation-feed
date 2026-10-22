import real from "@/data/manifest.json";
import synthetic from "@/data/manifest.synthetic.json";
import { manifestSchema, type MediaItem } from "./manifest.ts";

/**
 * Every item, in feed order. Server only: it brings zod and the whole manifest along.
 * FEED_MEDIA=synthetic swaps in the small synthetic set the tests run against (the e2e build
 * and server set it); production uses the real media.
 */
export const feedItems: readonly MediaItem[] = manifestSchema.parse(process.env.FEED_MEDIA === "synthetic" ? synthetic : real);
