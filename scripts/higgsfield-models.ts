// The Higgsfield models M5 uses and what they cost. Prices from higgsfield.ai/higgsfield-api and
// the model pages on open.higgsfield.ai, checked on 2026-10-16, and corrected where the console
// charged more. "sale" is what a job costs today; "list" is the price if the current discount
// ends. Check again before every paid run, and compare the console with the log after it.

export const PRICES_CHECKED = "2026-10-16";

export type AspectRatio = "1:1" | "3:4" | "4:3" | "2:3" | "3:2" | "9:16" | "16:9";

const SOUL_RATIOS: readonly AspectRatio[] = ["9:16", "16:9", "4:3", "3:4", "1:1", "2:3", "3:2"];
const GROK_RATIOS: readonly AspectRatio[] = ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"];

/**
 * Image models, priced per image, plus `perReference` for each reference image a job sends.
 * `ratios` are the aspect ratios the endpoint accepts; `references` is how many input images a
 * job must give it, as [min, max].
 */
export const IMAGE_MODELS = {
  "soul-2-1080p": { name: "Soul 2", slug: "soul-2", resolution: "1080p", sale: 0.0057, list: 0.0057, perReference: 0, ratios: SOUL_RATIOS, references: [0, 0] },
  "soul-2-720p": { name: "Soul 2", slug: "soul-2", resolution: "720p", sale: 0.0032, list: 0.0032, perReference: 0, ratios: SOUL_RATIOS, references: [0, 0] },
  /**
   * Grok Imagine 2.0 at 2k, medium quality: generates, or edits with up to 10 reference images.
   * The console charged $0.09 for each image made from one reference, so $0.01 is counted per
   * reference image (per image would be $1 cheaper over the plan; this errs on the safe side).
   */
  "grok-imagine-2-2k": { name: "Grok Imagine 2.0", slug: "grok-imagine-2", resolution: "2k", sale: 0.08, list: 0.08, perReference: 0.01, ratios: GROK_RATIOS, references: [0, 10] },
} as const;

/** Image-to-video, priced per second of video. */
export const VIDEO_MODELS = {
  // Kling 2.5: 50% off once claimed as one of the launch offer's 3 discounted models (both modes,
  // for 7 days). Unclaimed, the console charges 15% off list: $0.035 and $0.06 a second.
  "kling-2.5-standard": { name: "Kling 2.5", slug: "kling-2-5", resolution: "720p", sale: 0.021, list: 0.042 },
  "kling-2.5-pro": { name: "Kling 2.5 Pro", slug: "kling-2-5-pro", resolution: "1080p", sale: 0.035, list: 0.07 },
  /**
   * Higgsfield's Cinema Studio 4.0: the camera move is a `camera_movement` preset, the source
   * image goes in as a reference (`<<<image_1>>>`), audio off, pacing "single-shot".
   */
  "cinema-studio-4-480p": { name: "Cinema Studio 4.0", slug: "cinema-studio-4", resolution: "480p", sale: 0.2057, list: 0.2057 },
} as const;

/** The Cinema Studio `camera_movement` presets M5 uses (the API has 33). */
export const CINEMA_STUDIO_MOVES = ["dolly-in", "dolly-out", "drone-orbit", "crane-up", "crush-zoom", "whip-pan", "dolly-zoom", "bullet-time"] as const;
export type CinemaStudioMove = (typeof CINEMA_STUDIO_MOVES)[number];

export type ImageModel = keyof typeof IMAGE_MODELS;
export type VideoModel = keyof typeof VIDEO_MODELS;
export type PriceLevel = "sale" | "list";

export function imageCost(model: ImageModel, references: number, level: PriceLevel): number {
  return IMAGE_MODELS[model][level] + references * IMAGE_MODELS[model].perReference;
}

export function videoCost(model: VideoModel, seconds: number, level: PriceLevel): number {
  return VIDEO_MODELS[model][level] * seconds;
}
