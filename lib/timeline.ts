import type { MediaItem } from "./manifest.ts";

/**
 * Storyboard Timeline (project 2), the browser editor that cuts the story's clips into a short
 * film. Its `?demo=story` opens the robot story, ready to edit: into an empty project, or, when
 * the visitor already has a cut there, after asking.
 */
export const TIMELINE_ORIGIN = "https://storyboard-timeline.vercel.app";

/** Where an item opens in the Timeline: a story clip opens the whole story; other items, nowhere. */
export function timelineHref(item: Pick<MediaItem, "collection">): string | null {
  return item.collection === "story" ? `${TIMELINE_ORIGIN}/?demo=story` : null;
}
