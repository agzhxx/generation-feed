// Turns the media plan's lists (scripts/prompt-lists.ts) into every M5 generation job. Pure and
// seeded: building twice gives the same jobs in the same order, so the generate script can skip
// finished jobs, send each key as the request's Idempotency-Key, and a re-run never pays twice.
// Jobs that start from other images (`references`) always come after them.
import type { AspectRatio, CinemaStudioMove, ImageModel, VideoModel } from "./higgsfield-models.ts";
import {
  AD_GROUP_PACKSHOTS,
  AD_GROUP_SCENES,
  AD_PACKSHOT_STYLE,
  AD_PRODUCTS,
  AD_SCENE_STYLE,
  ALMATY_CAMERAS,
  ALMATY_LIGHTS,
  ALMATY_STYLE,
  ALMATY_TOPICS,
  CAMERA_MOVES,
  CAMERA_SCENE_STYLE,
  CAMERA_SCENES,
  DAY_NIGHT_SCENES,
  RATIO_SCENES,
  RATIO_STYLE,
  STORY_HERO,
  STORY_SHOTS,
  STORY_STYLE,
  STYLES,
  TEXTURE_MOTION_STYLE,
  TEXTURE_STYLE,
  TEXTURES,
  WORLD_THEMES,
  type AdProduct,
  type CameraMove,
  type CameraScene,
  type WorldTheme,
} from "./prompt-lists.ts";
import { COLLECTIONS, type Collection } from "../lib/collections.ts";
import { PICKED_VIDEOS } from "./picks.ts";

// The collections are the Feed's (lib/collections.ts), so the plan and the Feed share one list.
export { COLLECTIONS, type Collection };

export const PROJECTS = ["feed", "timeline", "kit", "shot-lab", "queue", "node-board", "reframe", "portfolio"] as const;
export type Project = (typeof PROJECTS)[number];

/** Which projects use each collection (media plan, section 3). */
export const USED_BY: Record<Collection, readonly Project[]> = {
  worlds: ["feed", "kit", "portfolio"],
  "camera-moves": ["feed", "kit", "shot-lab", "portfolio"],
  story: ["timeline", "feed", "node-board", "portfolio"],
  pairs: ["kit", "queue"],
  ratios: ["kit", "reframe", "feed"],
  almaty: ["feed", "portfolio"],
  textures: ["portfolio", "shot-lab", "kit"],
  ads: ["reframe", "queue", "feed"],
};

export type Variant = "draft" | "final" | "day" | "night";

export interface ImageJob {
  kind: "image";
  /** Stable name, e.g. "worlds-042"; the generate script records results under it. */
  key: string;
  collection: Collection;
  model: ImageModel;
  prompt: string;
  aspectRatio: AspectRatio;
  /**
   * Keys of earlier images this job starts from, sent to Grok as reference images.
   */
  references?: string[];
  /** Soul 2 only: a fixed seed (1–1,000,000), so the same prompt gives the same picture. */
  seed?: number;
  /** How to animate this image if it is picked; absent = written after picking, from the image. */
  motion?: string;
  shot?: string;
  pairId?: string;
  variant?: Variant;
  ratioGroup?: string;
}

export interface VideoJob {
  kind: "video";
  key: string;
  collection: Collection;
  model: VideoModel;
  prompt: string;
  durationSec: number;
  /** Key of the image it animates (Kling) or uses as its reference (Cinema Studio). */
  source: string;
  cameraMove?: string;
  /** Cinema Studio's `camera_movement` preset. */
  cameraPreset?: CinemaStudioMove;
  shot?: string;
}

/** Clips made from images picked on a contact sheet: how many for a collection, on which model. */
export interface VideoPicks {
  collection: Collection;
  count: number;
  model: VideoModel;
}

export interface MediaPlan {
  images: ImageJob[];
  videos: VideoJob[];
  /** Clips still to pick. */
  picks: VideoPicks[];
}

export const SEED = 20261016;
export const CLIP_SECONDS = 5;
const IMAGE_MODEL: ImageModel = "soul-2-1080p";
/** Pairs: the quick draft is the same model at a lower resolution. */
const DRAFT_MODEL: ImageModel = "soul-2-720p";
/**
 * Story, ads and pairs: one model that keeps a subject, or a whole picture, the same from
 * reference images. A pair's final redraws its draft and a night image re-lights its day image.
 */
const REFERENCE_MODEL: ImageModel = "grok-imagine-2-2k";
/** Pairs: the redraw may change only what its prompt asks for, so both halves line up. */
const KEEP_FRAMING = "Keep the composition, framing and every object of the reference image exactly where they are";
const VIDEO_MODEL: VideoModel = "kling-2.5-standard";
/** The story is the Timeline's showreel, so its clips are 1080p. */
const STORY_VIDEO_MODEL: VideoModel = "kling-2.5-pro";
/** Higgsfield's own camera presets cost about 10× Kling, so one scene gets them (Agzhan's call). */
const PRESET_SCENE = "red-car";
const PRESET_VIDEO_MODEL: VideoModel = "cinema-studio-4-480p";
const VIDEO_SUFFIX = "one continuous shot, no cuts";

const WORLD_COUNT = 680;
const ALMATY_COUNT = 120;
/** How many of each collection's images become clips, picked from the contact sheets. */
export const PICKS: VideoPicks[] = [
  // 35: 23, plus the 12 Kling clips camera-moves gave up (orbit, crash zoom, dolly zoom and
  // bullet time, × 3 scenes).
  { collection: "worlds", count: 35, model: VIDEO_MODEL },
  { collection: "almaty", count: 10, model: VIDEO_MODEL },
  { collection: "textures", count: 10, model: VIDEO_MODEL },
  { collection: "ads", count: 10, model: VIDEO_MODEL },
];

/** The Feed's shape mix (media plan 4.1), in percent. Only ratios Soul 2 accepts. */
export const RATIO_MIX: [AspectRatio, number][] = [
  ["3:4", 30],
  ["9:16", 25],
  ["16:9", 20],
  ["1:1", 15],
  ["2:3", 5],
  ["3:2", 5],
];

/** A small seeded random number generator (mulberry32): the same seed, the same sequence. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Splits `total` into `parts` near-equal whole numbers, the larger ones first. */
function split(total: number, parts: number): number[] {
  return Array.from({ length: parts }, (_, i) => Math.floor(total / parts) + (i < total % parts ? 1 : 0));
}

/** `count` ratios in RATIO_MIX's proportions, shuffled. */
function ratioDeck(count: number, random: () => number): AspectRatio[] {
  const shares = RATIO_MIX.map(([ratio, percent]) => ({ ratio, exact: (count * percent) / 100 }));
  const counts = shares.map((share) => Math.floor(share.exact));
  // Hand out what rounding down left over to the largest remainders.
  const byRemainder = shares.map((share, i) => ({ i, rest: share.exact - counts[i] })).sort((a, b) => b.rest - a.rest);
  for (let k = 0; k < count - counts.reduce((sum, n) => sum + n, 0); k++) counts[byRemainder[k].i]++;
  return shuffle(
    shares.flatMap((share, i) => Array<AspectRatio>(counts[i]).fill(share.ratio)),
    random,
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function worldPrompt(subject: string, light: string, camera: string, palette: string, style: string): string {
  return [capitalize(subject), light, camera, palette, style].join(", ");
}

/**
 * `count` different prompts from one theme. Every subject gets an equal share (the remainder
 * goes to randomly chosen subjects), each with its own random light, camera, colors and style.
 */
function themePrompts(theme: WorldTheme, count: number, random: () => number): string[] {
  const { subjects, lights, cameras, palettes, styles } = theme;
  const shares = split(count, subjects.length);
  const order = shuffle(
    subjects.map((_, s) => s),
    random,
  );
  return order.flatMap((s, rank) => {
    const combos: number[][] = [];
    lights.forEach((_, l) => cameras.forEach((_, c) => palettes.forEach((_, p) => styles.forEach((_, st) => combos.push([l, c, p, st])))));
    return shuffle(combos, random)
      .slice(0, shares[rank])
      .map(([l, c, p, st]) => worldPrompt(subjects[s], lights[l], cameras[c], palettes[p], STYLES[styles[st]]));
  });
}

/** "worlds-001" for index 0. */
function numbered(prefix: string, index: number, digits = 3): string {
  return `${prefix}-${String(index + 1).padStart(digits, "0")}`;
}

/** "p01" for index 0. */
function shortId(letter: string, index: number): string {
  return `${letter}${String(index + 1).padStart(2, "0")}`;
}

function worldImages(random: () => number): ImageJob[] {
  const quotas = split(WORLD_COUNT, WORLD_THEMES.length);
  // Shuffled across themes, so neighbouring keys (and the generation order) mix the themes.
  const prompts = shuffle(
    WORLD_THEMES.flatMap((theme, t) => themePrompts(theme, quotas[t], random)),
    random,
  );
  const ratios = ratioDeck(prompts.length, random);
  return prompts.map((prompt, i) => ({
    kind: "image",
    key: numbered("worlds", i),
    collection: "worlds",
    model: IMAGE_MODEL,
    prompt,
    aspectRatio: ratios[i],
  }));
}

function cameraMoves(): { images: ImageJob[]; videos: VideoJob[] } {
  const images: ImageJob[] = CAMERA_SCENES.map((scene) => ({
    kind: "image",
    key: `camera-moves-${scene.slug}`,
    collection: "camera-moves",
    model: IMAGE_MODEL,
    prompt: `${capitalize(scene.image)}, ${CAMERA_SCENE_STYLE}`,
    aspectRatio: "16:9",
  }));
  // The preset scene shows all 8 moves; the Kling scenes only the moves Kling showed in the tests.
  const videos = CAMERA_SCENES.flatMap((scene) =>
    CAMERA_MOVES.filter((move) => scene.slug === PRESET_SCENE || move.presetOnly !== true).map((move) => cameraMoveVideo(scene, move)),
  );
  return { images, videos };
}

/** One scene animated with one move: by its preset on the preset scene, by Kling elsewhere. */
export function cameraMoveVideo(scene: CameraScene, move: CameraMove): VideoJob {
  const job = {
    kind: "video" as const,
    key: `camera-moves-${scene.slug}-${move.slug}`,
    collection: "camera-moves" as const,
    durationSec: CLIP_SECONDS,
    source: `camera-moves-${scene.slug}`,
    cameraMove: move.slug,
  };
  // The preset performs the move, so that prompt only describes the scene and what moves in it.
  return scene.slug === PRESET_SCENE
    ? { ...job, model: PRESET_VIDEO_MODEL, prompt: `Use <<<image_1>>> as the scene: ${scene.image}, while ${scene.ambient}, ${VIDEO_SUFFIX}`, cameraPreset: move.preset }
    : { ...job, model: VIDEO_MODEL, prompt: `${move.prompt(scene)}, ${VIDEO_SUFFIX}` };
}

function story(): { images: ImageJob[]; videos: VideoJob[] } {
  const heroKey = "story-00-hero";
  const hero: ImageJob = {
    kind: "image",
    key: heroKey,
    collection: "story",
    model: REFERENCE_MODEL,
    prompt: `Character design of ${STORY_HERO}, three-quarter view on a plain warm grey background, ${STORY_STYLE}`,
    aspectRatio: "1:1",
    shot: "00-hero",
  };
  const shots: ImageJob[] = STORY_SHOTS.map(({ shot, image, when }) => {
    const withRobot = image.includes("the robot");
    return {
      kind: "image",
      key: `story-${shot}`,
      collection: "story",
      model: REFERENCE_MODEL,
      // The hero's description as its own sentence keeps the action readable.
      prompt: withRobot
        ? `${image}, ${when}. The robot is ${STORY_HERO}, as in the reference image. ${capitalize(STORY_STYLE)}`
        : `${image}, ${when}, ${STORY_STYLE}`,
      aspectRatio: "16:9",
      references: withRobot ? [heroKey] : undefined,
      shot,
    };
  });
  const videos: VideoJob[] = STORY_SHOTS.map(({ shot, motion }) => ({
    kind: "video",
    key: `story-${shot}-clip`,
    collection: "story",
    model: STORY_VIDEO_MODEL,
    prompt: `${motion}, ${VIDEO_SUFFIX}`,
    durationSec: CLIP_SECONDS,
    source: `story-${shot}`,
    shot,
  }));
  return { images: [hero, ...shots], videos };
}

/**
 * 25 draft/final pairs reusing `worlds` subjects in a combination `worlds` doesn't have, and 5
 * day/night pairs. The final re-renders its draft and the night image re-lights its day image,
 * so the two halves of a compare slider line up.
 */
function pairs(worldPrompts: ReadonlySet<string>): ImageJob[] {
  const jobs: ImageJob[] = [];
  for (let i = 0; i < 25; i++) {
    const theme = WORLD_THEMES[i % WORLD_THEMES.length];
    const subject = theme.subjects[theme.subjects.length - 1 - Math.floor(i / WORLD_THEMES.length)];
    const style = STYLES[theme.styles[0]];
    const prompt = theme.lights
      .map((light) => worldPrompt(subject, light, theme.cameras[0], theme.palettes[0], style))
      .find((candidate) => !worldPrompts.has(candidate));
    if (prompt === undefined) throw new Error(`Every pair prompt for "${subject}" is already in worlds`);
    const pairId = shortId("p", i);
    const aspectRatio: AspectRatio = i % 2 === 0 ? "3:4" : "16:9";
    const draftKey = `pairs-${pairId}-draft`;
    jobs.push(
      { kind: "image", key: draftKey, collection: "pairs", model: DRAFT_MODEL, prompt, aspectRatio, pairId, variant: "draft" },
      {
        kind: "image",
        key: `pairs-${pairId}-final`,
        collection: "pairs",
        model: REFERENCE_MODEL,
        prompt: `${prompt}, final high-resolution render with crisp, refined detail. ${KEEP_FRAMING}`,
        aspectRatio,
        references: [draftKey],
        pairId,
        variant: "final",
      },
    );
  }
  DAY_NIGHT_SCENES.forEach((scene, i) => {
    const pairId = shortId("p", 25 + i);
    const dayKey = `pairs-${pairId}-day`;
    const framing = `wide-angle at eye level, ${STYLES.film}`;
    jobs.push(
      {
        kind: "image",
        key: dayKey,
        collection: "pairs",
        model: IMAGE_MODEL,
        prompt: `${capitalize(scene)}, in bright midday light, ${framing}`,
        aspectRatio: "16:9",
        pairId,
        variant: "day",
      },
      {
        kind: "image",
        key: `pairs-${pairId}-night`,
        collection: "pairs",
        model: REFERENCE_MODEL,
        prompt: `${capitalize(scene)}, the same view at night under warm lights, ${framing}. ${KEEP_FRAMING}`,
        aspectRatio: "16:9",
        references: [dayKey],
        pairId,
        variant: "night",
      },
    );
  });
  return jobs;
}

function ratioGroups(): ImageJob[] {
  const ratios: AspectRatio[] = ["1:1", "3:4", "9:16", "16:9"];
  return RATIO_SCENES.flatMap((scene, i) => {
    const ratioGroup = shortId("r", i);
    return ratios.map((aspectRatio) => ({
      kind: "image" as const,
      key: `ratios-${ratioGroup}-${aspectRatio.replace(":", "x")}`,
      collection: "ratios" as const,
      model: IMAGE_MODEL,
      prompt: `${capitalize(scene)}, ${RATIO_STYLE}`,
      aspectRatio,
      ratioGroup,
    }));
  });
}

/** 3 or 4 images per topic (the larger shares go to random topics), each its own light and camera. */
function almaty(random: () => number): ImageJob[] {
  const shares = split(ALMATY_COUNT, ALMATY_TOPICS.length);
  const order = shuffle(
    ALMATY_TOPICS.map((_, t) => t),
    random,
  );
  const prompts = order.flatMap((t, rank) => {
    const topic = ALMATY_TOPICS[t];
    const lights = topic.lights ?? ALMATY_LIGHTS;
    const cameras = topic.cameras ?? ALMATY_CAMERAS;
    const combos = lights.flatMap((light) => cameras.map((camera) => [light, camera]));
    return shuffle(combos, random)
      .slice(0, shares[rank])
      .map(([light, camera]) => `${capitalize(topic.text)}, ${light}, ${camera}, ${topic.style ?? ALMATY_STYLE}`);
  });
  const mixed = shuffle(prompts, random);
  const ratios = ratioDeck(mixed.length, random);
  return mixed.map((prompt, i) => ({
    kind: "image",
    key: numbered("almaty", i),
    collection: "almaty",
    model: IMAGE_MODEL,
    prompt,
    aspectRatio: ratios[i],
  }));
}

function textures(): ImageJob[] {
  return TEXTURES.map((texture, i) => ({
    kind: "image",
    key: numbered("textures", i, 2),
    collection: "textures",
    model: IMAGE_MODEL,
    prompt: `${capitalize(texture.text)}, ${TEXTURE_STYLE}`,
    // Mostly 16:9 overlays for video, every third one 9:16 for vertical edits.
    aspectRatio: i % 3 === 2 ? "9:16" : "16:9",
    motion: `${texture.motion}, ${TEXTURE_MOTION_STYLE}`,
  }));
}

const heroKey = (product: AdProduct) => `ads-${product.slug}-hero`;

/** A product's hero packshot, then its other images, all made from the hero. */
function productImages(product: AdProduct): ImageJob[] {
  const same = `The same product as in the reference image, ${product.item}`;
  const fromHero = (key: string, prompt: string, aspectRatio: AspectRatio): ImageJob => ({
    kind: "image",
    key,
    collection: "ads",
    model: REFERENCE_MODEL,
    prompt,
    aspectRatio,
    references: [heroKey(product)],
  });
  const hero: ImageJob = {
    kind: "image",
    key: heroKey(product),
    collection: "ads",
    model: REFERENCE_MODEL,
    prompt: `${capitalize(product.item)} on a plain ${product.heroBackground} background, ${AD_PACKSHOT_STYLE}`,
    aspectRatio: "1:1",
  };
  return [
    hero,
    ...product.backgrounds.map((background, i) =>
      fromHero(numbered(`ads-${product.slug}-packshot`, i, 2), `${same}, on a plain ${background} background, ${AD_PACKSHOT_STYLE}`, i % 2 === 0 ? "3:4" : "1:1"),
    ),
    ...product.details.map((detail, i) =>
      fromHero(numbered(`ads-${product.slug}-detail`, i, 2), `The same product as in the reference image: ${detail}, ${AD_PACKSHOT_STYLE}`, "3:4"),
    ),
    ...product.scenes.map((scene, i) => fromHero(numbered(`ads-${product.slug}-scene`, i, 2), `${same}, ${scene}, ${AD_SCENE_STYLE}`, i % 2 === 0 ? "3:4" : "9:16")),
    ...product.inMotion.map((shot, i) => ({
      ...fromHero(
        numbered(`ads-${product.slug}-motion`, i, 2),
        `The same product as in the reference image: ${shot.text}, ${shot.scene === true ? AD_SCENE_STYLE : AD_PACKSHOT_STYLE}`,
        "16:9",
      ),
      motion: shot.motion,
    })),
  ];
}

/** The four products together, made from all four hero packshots. */
function groupImages(): ImageJob[] {
  const names = AD_PRODUCTS.map((product) => product.short);
  const together = `${capitalize(`${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`)} from the reference images`;
  const settings = [
    ...AD_GROUP_PACKSHOTS.map((setting) => ({ setting, style: AD_PACKSHOT_STYLE })),
    ...AD_GROUP_SCENES.map((setting) => ({ setting, style: AD_SCENE_STYLE })),
  ];
  const ratios: AspectRatio[] = ["16:9", "16:9", "1:1", "1:1", "3:4", "3:4", "9:16", "9:16"];
  return settings.map(({ setting, style }, i) => ({
    kind: "image",
    key: numbered("ads-group", i, 2),
    collection: "ads",
    model: REFERENCE_MODEL,
    prompt: `${together}, ${setting}, ${style}`,
    aspectRatio: ratios[i],
    references: AD_PRODUCTS.map(heroKey),
  }));
}

/** Every image and video job of M5, plus the videos still to be picked. */
export function buildMediaPlan(): MediaPlan {
  const random = seededRandom(SEED);
  const worlds = worldImages(random);
  const camera = cameraMoves();
  const storyJobs = story();
  const images = [
    ...worlds,
    ...camera.images,
    ...storyJobs.images,
    ...pairs(new Set(worlds.map((job) => job.prompt))),
    ...ratioGroups(),
    ...almaty(random),
    ...textures(),
    ...AD_PRODUCTS.flatMap(productImages),
    ...groupImages(),
  ];
  const picked = pickedVideos(images);
  // What is still to pick: nothing, once scripts/picks.ts has every collection's count.
  const toPick = PICKS.map((pick) => ({ ...pick, count: pick.count - picked.filter((video) => video.collection === pick.collection).length }));
  return { images, videos: [...camera.videos, ...storyJobs.videos, ...picked], picks: toPick.filter((pick) => pick.count > 0) };
}

/** A clip for each picked image: its written motion line, or the motion planned with the image. */
function pickedVideos(images: readonly ImageJob[]): VideoJob[] {
  const byKey = new Map(images.map((job) => [job.key, job]));
  return PICKED_VIDEOS.map(({ key, motion }) => {
    const image = byKey.get(key);
    const pick = PICKS.find((candidate) => candidate.collection === image?.collection);
    if (image === undefined || pick === undefined) throw new Error(`${key} is not an image of a collection that gets picked clips`);
    const prompt = motion === undefined ? pickedVideoPrompt(image) : `${capitalize(motion)}, ${VIDEO_SUFFIX}`;
    if (prompt === null) throw new Error(`${key} needs a motion line: it has no motion planned`);
    return { kind: "video", key: `${key}-clip`, collection: image.collection, model: pick.model, prompt, durationSec: CLIP_SECONDS, source: key };
  });
}

/** The planned video prompt for a picked image, or null when it is written after picking. */
export function pickedVideoPrompt(image: ImageJob): string | null {
  return image.motion === undefined ? null : `${capitalize(image.motion)}, ${VIDEO_SUFFIX}`;
}
