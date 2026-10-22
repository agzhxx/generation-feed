/**
 * The groups the M5 media was made in (docs/MEDIA_PLAN.md section 4), with the names the
 * Feed's filter shows. A module of its own, with no imports, so the browser's filter code
 * gets these few strings without the manifest schema.
 */
export const COLLECTIONS = ["worlds", "camera-moves", "story", "pairs", "ratios", "almaty", "textures", "ads"] as const;
export type Collection = (typeof COLLECTIONS)[number];

export const COLLECTION_LABELS: Record<Collection, string> = {
  worlds: "Worlds",
  "camera-moves": "Camera moves",
  story: "Story",
  pairs: "Pairs",
  ratios: "Ratios",
  almaty: "Almaty",
  textures: "Textures",
  ads: "Ads",
};

export function isCollection(value: string): value is Collection {
  return (COLLECTIONS as readonly string[]).includes(value);
}
