// Makes synthetic test media: 300 numbered images and 40 short videos in mixed aspect ratios,
// plus media-src/dev/sources.json for scripts/ingest.ts. Free, no licensing questions, and it
// doubles as test data. Files that already exist are kept, so reruns are quick.
//
// Usage: pnpm media:dev   (the videos need ffmpeg: brew install ffmpeg)
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { availableParallelism } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import { COLLECTIONS } from "../lib/collections.ts";
import { mapConcurrent } from "./pool.ts";
import type { SourceItem } from "./sources.ts";

const run = promisify(execFile);

const OUT_DIR = "media-src/dev";
const ITEM_COUNT = 340;
const VIDEO_COUNT = 40;
const VIDEO_EVERY = 8; // items 3, 11, 19, ... are videos until there are 40
const IMAGE_LONG_SIDE = 2048;
const VIDEO_SHORT_SIDE = 720;
const NEWEST = Date.UTC(2026, 9, 14, 12); // createdAt of item 0; each next item is older
const STEP_MS = 37 * 60 * 1000;

const ASPECTS = [
  [1, 1],
  [4, 5],
  [3, 4],
  [9, 16],
  [16, 9],
  [21, 9],
] as const;

const COLORS = [
  ["neon magenta", "#ff2bd6"],
  ["teal", "#14b8a6"],
  ["amber", "#f59e0b"],
  ["cobalt", "#2563eb"],
  ["lime", "#84cc16"],
  ["coral", "#fb7185"],
  ["violet", "#8b5cf6"],
  ["sand", "#d6c4a1"],
  ["mint", "#6ee7b7"],
  ["crimson", "#dc2626"],
  ["ice", "#bae6fd"],
  ["graphite", "#3f3f46"],
] as const;

const PATTERNS = ["stripes", "grid", "rings", "checker"] as const;
type Pattern = (typeof PATTERNS)[number];

const MOTIONS = ["test card", "life", "gradient drift", "cellular automaton"] as const;
type Motion = (typeof MOTIONS)[number];

type Aspect = (typeof ASPECTS)[number];

function aspectLabel([w, h]: Aspect): string {
  return `${w}:${h}`;
}

function even(value: number): number {
  return Math.round(value / 2) * 2;
}

/** Size with the given long side (images) or short side (videos), both even. */
function sizeFor([aw, ah]: Aspect, side: number, which: "long" | "short"): [number, number] {
  const landscape = aw >= ah;
  const fixedIsWidth = which === "long" ? landscape : !landscape;
  return fixedIsWidth ? [side, even((side * ah) / aw)] : [even((side * aw) / ah), side];
}

function escapeXml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function patternDefs(pattern: Pattern, w: number, h: number): string {
  const u = Math.round(Math.min(w, h) / 12);
  switch (pattern) {
    case "stripes":
      return `<pattern id="p" width="${u}" height="${u}" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="${u / 2}" height="${u}" fill="#fff" fill-opacity="0.14"/></pattern>`;
    case "grid":
      return `<pattern id="p" width="${u}" height="${u}" patternUnits="userSpaceOnUse"><path d="M ${u} 0 L 0 0 0 ${u}" fill="none" stroke="#fff" stroke-opacity="0.28" stroke-width="3"/></pattern>`;
    case "checker":
      return `<pattern id="p" width="${2 * u}" height="${2 * u}" patternUnits="userSpaceOnUse"><rect width="${u}" height="${u}" fill="#fff" fill-opacity="0.12"/><rect x="${u}" y="${u}" width="${u}" height="${u}" fill="#fff" fill-opacity="0.12"/></pattern>`;
    case "rings":
      return `<radialGradient id="p" gradientUnits="userSpaceOnUse" cx="${w / 2}" cy="${h / 2}" r="${u}" spreadMethod="repeat"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`;
  }
}

/** Centered big number and a caption, readable on any background. */
function labelSvg(w: number, h: number, number: string, caption: string): string {
  const big = Math.round(Math.min(w, h) * 0.22);
  const small = Math.round(Math.min(w, h) * 0.05);
  const text = `font-family="Helvetica Neue, Helvetica, Arial, sans-serif" text-anchor="middle" fill="#fff" stroke="#000" stroke-opacity="0.35" paint-order="stroke"`;
  return `<text x="${w / 2}" y="${h / 2 + big * 0.35}" font-size="${big}" font-weight="700" stroke-width="${big / 20}" ${text}>${escapeXml(number)}</text>
<text x="${w / 2}" y="${h / 2 + big * 0.35 + small * 1.8}" font-size="${small}" stroke-width="${small / 12}" ${text}>${escapeXml(caption)}</text>`;
}

async function makeImage(file: string, index: number, aspect: Aspect): Promise<Omit<SourceItem, "file" | "createdAt">> {
  const [w, h] = sizeFor(aspect, IMAGE_LONG_SIDE, "long");
  const [nameA, colorA] = COLORS[index % COLORS.length];
  const [nameB, colorB] = COLORS[(index * 5 + 3) % COLORS.length];
  const pattern = PATTERNS[Math.floor(index / ASPECTS.length) % PATTERNS.length];
  const number = `#${String(index + 1).padStart(3, "0")}`;
  const caption = `${aspectLabel(aspect)} · ${pattern} · test pattern`;

  if (!existsSync(file)) {
    const angle = (index * 47) % 360;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
<defs><linearGradient id="g" gradientTransform="rotate(${angle} 0.5 0.5)"><stop offset="0" stop-color="${colorA}"/><stop offset="1" stop-color="${colorB}"/></linearGradient>${patternDefs(pattern, w, h)}</defs>
<rect width="100%" height="100%" fill="url(#g)"/><rect width="100%" height="100%" fill="url(#p)"/>
${labelSvg(w, h, number, caption)}
</svg>`;
    await sharp(Buffer.from(svg)).jpeg({ quality: 92, chromaSubsampling: "4:4:4" }).toFile(file);
  }

  const model = pattern === "stripes" || pattern === "checker" ? "Bars Lab" : "Grid Studio";
  return {
    kind: "image",
    prompt: `Test pattern ${number}: ${nameA} to ${nameB} gradient with ${pattern}, ${aspectLabel(aspect)}`,
    model,
    modelSlug: model.toLowerCase().replace(/ /g, "-"),
  };
}

function motionSource(motion: Motion, w: number, h: number, color: string): string {
  const size = `s=${w}x${h}:r=30`;
  switch (motion) {
    case "test card":
      return `testsrc2=${size}`;
    case "life":
      return `life=${size}:mold=10:ratio=0.1:life_color=${color}:death_color=#1f1f22:mold_color=#0b0b0c`;
    case "gradient drift":
      return `gradients=${size}:c0=${color}:c1=#2563eb:c2=#f59e0b:nb_colors=3:speed=0.03`;
    case "cellular automaton":
      return `cellauto=${size}:rule=110:random_fill_ratio=0.5`;
  }
}

async function makeVideo(file: string, videoIndex: number, aspect: Aspect): Promise<Omit<SourceItem, "file" | "createdAt">> {
  const [w, h] = sizeFor(aspect, VIDEO_SHORT_SIDE, "short");
  const motion = MOTIONS[videoIndex % MOTIONS.length];
  const [colorName, color] = COLORS[(videoIndex * 7) % COLORS.length];
  const seconds = videoIndex % 4 === 3 ? 10 : 5;
  const number = `#${String(videoIndex + 1).padStart(2, "0")}`;

  if (!existsSync(file)) {
    const overlay = `${file}.overlay.png`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${labelSvg(w, h, number, `${aspectLabel(aspect)} · ${seconds}s · ${motion}`)}</svg>`;
    await sharp(Buffer.from(svg)).png().toFile(overlay);
    await run("ffmpeg", [
      ...["-y", "-hide_banner", "-loglevel", "error"],
      ...["-f", "lavfi", "-i", motionSource(motion, w, h, color), "-i", overlay],
      ...["-filter_complex", "[0:v][1:v]overlay=0:0,format=yuv420p", "-t", String(seconds)],
      ...["-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-an", "-movflags", "+faststart"],
      file,
    ]);
  }

  const model = videoIndex % 2 === 0 ? "Motion Test" : "Loop Lab";
  return {
    kind: "video",
    prompt: `Motion test ${number}: ${motion} in ${colorName}, ${aspectLabel(aspect)}, ${seconds} seconds`,
    model,
    modelSlug: model.toLowerCase().replace(/ /g, "-"),
  };
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });

  let imageCount = 0;
  let videoCount = 0;
  const plan = Array.from({ length: ITEM_COUNT }, (_, n) => {
    const isVideo = n % VIDEO_EVERY === 3 && videoCount < VIDEO_COUNT;
    return { n, isVideo, kindIndex: isVideo ? videoCount++ : imageCount++ };
  });

  const images = plan.filter((entry) => !entry.isVideo);
  console.log(`Making ${images.length} images in ${OUT_DIR}/ …`);
  const imageMeta = await mapConcurrent(images, availableParallelism(), async ({ kindIndex }) => {
    const file = `image-${String(kindIndex + 1).padStart(3, "0")}.jpg`;
    const aspect = ASPECTS[kindIndex % ASPECTS.length];
    return { file, ...(await makeImage(path.join(OUT_DIR, file), kindIndex, aspect)) };
  });

  try {
    await run("ffmpeg", ["-version"]);
  } catch {
    throw new Error("ffmpeg is needed for the videos. Install it with: brew install ffmpeg");
  }

  const videos = plan.filter((entry) => entry.isVideo);
  console.log(`Making ${videos.length} videos …`);
  const videoMeta = await mapConcurrent(videos, Math.max(1, availableParallelism() / 2), async ({ kindIndex }) => {
    const file = `video-${String(kindIndex + 1).padStart(2, "0")}.mp4`;
    const aspect = ASPECTS[(kindIndex * 5) % ASPECTS.length];
    return { file, ...(await makeVideo(path.join(OUT_DIR, file), kindIndex, aspect)) };
  });

  let imageCursor = 0;
  let videoCursor = 0;
  const sources: SourceItem[] = plan.map(({ n, isVideo }) => ({
    ...(isVideo ? videoMeta[videoCursor++] : imageMeta[imageCursor++]),
    createdAt: new Date(NEWEST - n * STEP_MS).toISOString(),
    // Each test item gets a collection in turn, so the collection filter has something to show.
    collection: COLLECTIONS[n % COLLECTIONS.length],
  }));

  await writeFile(path.join(OUT_DIR, "sources.json"), `${JSON.stringify(sources, null, 2)}\n`);
  console.log(`Wrote ${sources.length} sources to ${OUT_DIR}/sources.json`);
}

await main();
