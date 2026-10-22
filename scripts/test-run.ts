// The paid test runs before the full one (media plan, section 9).
//
// The first tries every model and every way a job starts: from text, from reference images
// (Grok), an image to animate (Kling standard and pro) and a camera preset (Cinema Studio). Plus 3
// `worlds` images per theme, to judge the look. (It also tried Soul 2 image-to-image for the
// pair's final, since dropped: it didn't keep the draft's layout.)
//
// The second answers what the first left open: two other ways to make pairs that line up (Grok
// won, and the plan now uses it), two more Kling moves, the coffee ads, and the images whose
// prompts were rewritten because the first test drew text in them. Jobs come in dependency order.
import type { Job } from "./generation.ts";
import { CAMERA_MOVES, CAMERA_SCENES, WORLD_THEMES } from "./prompt-lists.ts";
import { cameraMoveVideo, type ImageJob, type MediaPlan } from "./prompts.ts";

/** Each image that starts other jobs comes before them. */
const TEST_IMAGES = ["pairs-p01-draft", "pairs-p01-final", "story-00-hero", "story-02-medium", "camera-moves-lighthouse", "camera-moves-red-car"];
/** The orbit is the hardest move: Kling's 90° arc next to Cinema Studio's drone orbit. */
const TEST_VIDEOS = ["camera-moves-lighthouse-orbit", "story-02-medium-clip", "camera-moves-red-car-orbit"];
const WORLDS_PER_THEME = 3;

/** Plan images the second test makes: inputs for the pair trials, the coffee ads, and the rewrites. */
const SECOND_TEST_IMAGES = [
  "pairs-p04-draft",
  "pairs-p26-day",
  "ads-coffee-hero",
  "ads-coffee-packshot-01",
  "worlds-002",
  "worlds-010",
  "worlds-013",
  "worlds-019",
  "worlds-023",
  "worlds-051",
  "camera-moves-red-car",
];
/** Kling's fast and tricky moves; the first test's slow arc was weak. Both weak too: now the red car's only. */
const SECOND_TEST_VIDEOS = ["camera-moves-lighthouse-crash-zoom", "camera-moves-lighthouse-dolly-zoom"];
/** Pairs, way 1: Soul 2 from text with a fixed seed, the draft at 720p and the final at 1080p. */
const SEED_PAIRS = ["p02", "p03"];
/** Any fixed number from 1 to 1,000,000: the same seed and prompt should give the same picture. */
const PAIR_SEED = 161016;
/**
 * Pairs, way 2: Grok redraws the draft (or the day image) it gets as a reference, as the plan's
 * pairs now do. p01's draft and its Soul 2 image-to-image final are from the first test, so the
 * two ways met on one draft.
 */
const GROK_FINALS = ["p01", "p04"];
const GROK_NIGHTS = ["p26"];

/** Made in the first test; the second test's contact sheet shows them next to what replaces them. */
const SECOND_TEST_SHOWN_WITH = ["pairs-p01-draft", "pairs-p01-final", "camera-moves-lighthouse", "camera-moves-lighthouse-orbit"];

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function find<T extends Job>(jobs: readonly T[], key: string): T {
  const job = jobs.find((candidate) => candidate.key === key);
  if (job === undefined) throw new Error(`The test run needs ${key}, which the plan doesn't have`);
  return job;
}

/** The plan's videos, plus every Kling move the tests tried that the plan has since dropped. */
const videosOf = (plan: MediaPlan) => [...plan.videos, ...CAMERA_SCENES.flatMap((scene) => CAMERA_MOVES.map((move) => cameraMoveVideo(scene, move)))];

export function testRunJobs(plan: MediaPlan): Job[] {
  const worlds = plan.images.filter((job) => job.collection === "worlds");
  const perTheme = WORLD_THEMES.flatMap((theme) =>
    worlds.filter((job) => theme.subjects.some((subject) => job.prompt.startsWith(`${capitalize(subject)},`))).slice(0, WORLDS_PER_THEME),
  );
  const videos = videosOf(plan);
  return [...perTheme, ...TEST_IMAGES.map((key) => find(plan.images, key)), ...TEST_VIDEOS.map((key) => find(videos, key))];
}

export function secondTestJobs(plan: MediaPlan): Job[] {
  const image = (key: string) => find(plan.images, key);
  const seedPairs = SEED_PAIRS.flatMap((pairId): ImageJob[] => {
    const draft = image(`pairs-${pairId}-draft`);
    return [
      { ...draft, key: `${draft.key}-seed`, seed: PAIR_SEED },
      { ...draft, key: `pairs-${pairId}-final-seed`, model: "soul-2-1080p", seed: PAIR_SEED, variant: "final" },
    ];
  });
  // The plan's own final or night job, under a trial key.
  const grokRedraw = (planned: ImageJob): ImageJob => ({ ...planned, key: `${planned.key}-grok` });
  return [
    ...SECOND_TEST_IMAGES.map(image),
    ...seedPairs,
    ...GROK_FINALS.map((pairId) => grokRedraw(image(`pairs-${pairId}-final`))),
    ...GROK_NIGHTS.map((pairId) => grokRedraw(image(`pairs-${pairId}-night`))),
    ...SECOND_TEST_VIDEOS.map((key) => find(videosOf(plan), key)),
  ];
}

export function secondTestShownWith(plan: MediaPlan): Job[] {
  const jobs = [...plan.images, ...videosOf(plan)];
  return SECOND_TEST_SHOWN_WITH.map((key) => find(jobs, key));
}
