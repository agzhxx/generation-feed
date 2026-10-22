// Prints what M5's generation would cost, per collection, and writes every prompt to a local
// review file. Makes no API calls and spends nothing.
//
// Usage: pnpm media:plan     (review file: media-src/real/prompts.md, not in git)
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fingerprint, readLog, summarize, totalSpent, type Job, type LogEntry } from "./generation.ts";
import { IMAGE_MODELS, imageCost, PRICES_CHECKED, VIDEO_MODELS, videoCost, type PriceLevel } from "./higgsfield-models.ts";
import { AD_BRAND } from "./prompt-lists.ts";
import { buildMediaPlan, CLIP_SECONDS, COLLECTIONS, pickedVideoPrompt, USED_BY, type Collection, type MediaPlan } from "./prompts.ts";

const REVIEW_PATH = "media-src/real/prompts.md";
const LOG_PATH = "media-src/real/generation-log.jsonl";
/** Room for redoing rejects: this share of the images and of the videos. */
const REDO_SHARE = { images: 0.05, videos: 0.1 };

/** How each collection is made, for whoever reviews the prompts. */
const NOTES: Partial<Record<Collection, string>> = {
  worlds: "Each subject is used once or twice. The 35 picked images get their motion written after picking, from what each image shows, so a video never adds weather the image doesn't have.",
  "camera-moves": "The red car uses Higgsfield's Cinema Studio presets at 480p, with its image as the reference, and shows all 8 moves. The other scenes use Kling, with the move described in the prompt and starting from the image, for the 4 moves Kling showed in the tests; orbit, crash zoom, dolly zoom and bullet time are the red car's only.",
  story: "Every shot uses Grok Imagine 2.0. Shots with the robot use the hero sheet as a reference image, so it stays the same robot. Every shot states its time and weather.",
  pairs: "Each final redraws its draft at 2k and each night image re-lights its day image, both with Grok Imagine 2.0 and the image as a reference, so both halves line up in a compare slider.",
  almaty: "35 topics, 3 or 4 images each. As in worlds, the 10 picked images get their motion written after picking.",
  textures: "Loops are made in editing (crossfade the end into the start), so the prompts don't ask for a seamless loop.",
  ads: "Every product image uses that product's hero packshot as a reference, and the group shots use all four, so the products look the same everywhere. Most motion setups move sideways, for Batch Reframe.",
};

interface Row {
  collection: string;
  images: number;
  videos: number;
  imageCost: Record<PriceLevel, number>;
  videoCost: Record<PriceLevel, number>;
}

function costRows(plan: MediaPlan): Row[] {
  return COLLECTIONS.map((collection) => {
    const images = plan.images.filter((job) => job.collection === collection);
    const videos = plan.videos.filter((job) => job.collection === collection);
    const picks = plan.picks.filter((pick) => pick.collection === collection);
    const cost = (level: PriceLevel) => ({
      images: images.reduce((sum, job) => sum + imageCost(job.model, job.references?.length ?? 0, level), 0),
      videos:
        videos.reduce((sum, job) => sum + videoCost(job.model, job.durationSec, level), 0) +
        picks.reduce((sum, pick) => sum + pick.count * videoCost(pick.model, CLIP_SECONDS, level), 0),
    });
    const sale = cost("sale");
    const list = cost("list");
    return {
      collection,
      images: images.length,
      videos: videos.length + picks.reduce((sum, pick) => sum + pick.count, 0),
      imageCost: { sale: sale.images, list: list.images },
      videoCost: { sale: sale.videos, list: list.videos },
    };
  });
}

const usd = (amount: number) => `$${amount.toFixed(2)}`;

const cost = (job: Job, level: PriceLevel) =>
  job.kind === "image" ? imageCost(job.model, job.references?.length ?? 0, level) : videoCost(job.model, job.durationSec, level);

function printEstimate(rows: Row[], plan: MediaPlan, log: readonly LogEntry[]): void {
  const total = (pick: (row: Row) => number) => rows.reduce((sum, row) => sum + pick(row), 0);
  console.log(`Prices checked ${PRICES_CHECKED}. "sale" = today's price, "list" = if the discount ends.\n`);
  console.log("collection      images   videos   images $   videos $ (sale / list)   total (sale / list)");
  for (const row of rows) {
    console.log(
      `${row.collection.padEnd(14)} ${String(row.images).padStart(7)} ${String(row.videos).padStart(8)} ` +
        `${usd(row.imageCost.sale).padStart(10)}   ${`${usd(row.videoCost.sale)} / ${usd(row.videoCost.list)}`.padStart(22)}` +
        `   ${`${usd(row.imageCost.sale + row.videoCost.sale)} / ${usd(row.imageCost.list + row.videoCost.list)}`.padStart(19)}`,
    );
  }
  const images = { sale: total((r) => r.imageCost.sale), list: total((r) => r.imageCost.list) };
  const videos = { sale: total((r) => r.videoCost.sale), list: total((r) => r.videoCost.list) };
  console.log(
    `${"all".padEnd(14)} ${String(total((r) => r.images)).padStart(7)} ${String(total((r) => r.videos)).padStart(8)} ` +
      `${usd(images.sale).padStart(10)}   ${`${usd(videos.sale)} / ${usd(videos.list)}`.padStart(22)}` +
      `   ${`${usd(images.sale + videos.sale)} / ${usd(images.list + videos.list)}`.padStart(19)}`,
  );

  // Plan jobs already made as the plan has them now (kept from the test runs) aren't made again;
  // what was spent is counted as it was charged, including results rejected since.
  const states = summarize(log);
  const made = [...plan.images, ...plan.videos].filter((job) => {
    const state = states.get(job.key);
    return state?.status === "completed" && state.fingerprint === fingerprint(job);
  });
  const reused = (level: PriceLevel) => made.reduce((sum, job) => sum + cost(job, level), 0);
  const spent = totalSpent(log);
  const redo = (level: PriceLevel) => REDO_SHARE.images * images[level] + REDO_SHARE.videos * videos[level];
  const grand = (level: PriceLevel) => spent + images[level] + videos[level] - reused(level) + redo(level);
  console.log(`\nSpent so far by the log: ${usd(spent)} (each job at the price known when it ran; the console has the real figure)`);
  console.log(`Already made, as the plan has them now: ${made.length} jobs, so the above costs ${usd(reused("sale"))} / ${usd(reused("list"))} less`);
  console.log(`Room to redo rejects (${REDO_SHARE.images * 100} % of images, ${REDO_SHARE.videos * 100} % of videos): ${usd(redo("sale"))} / ${usd(redo("list"))}`);
  console.log(`Everything: ${usd(grand("sale"))} at sale prices, ${usd(grand("list"))} at list prices.`);
}

const keys = (references: readonly string[]) => references.map((key) => `\`${key}\``).join(", ");

function reviewFile(plan: MediaPlan): string {
  const lines = [
    "# M5 prompts (generated by `pnpm media:plan`, local only)",
    "",
    `Fictional brand for \`ads\`: ${AD_BRAND.name} (${AD_BRAND.look}); never named in a prompt.`,
  ];
  for (const collection of COLLECTIONS) {
    const images = plan.images.filter((job) => job.collection === collection);
    const videos = plan.videos.filter((job) => job.collection === collection);
    const picks = plan.picks.find((pick) => pick.collection === collection);
    lines.push("", `## ${collection} (${images.length} images, used by ${USED_BY[collection].join(", ")})`, "");
    const note = NOTES[collection];
    if (note !== undefined) lines.push(note, "");
    for (const job of images) {
      const model = IMAGE_MODELS[job.model];
      const from = job.references === undefined ? "" : ` from ${keys(job.references)}`;
      lines.push(`- \`${job.key}\` ${job.aspectRatio} · ${model.name} ${model.resolution}${from}: ${job.prompt}`);
      const motion = pickedVideoPrompt(job);
      if (picks !== undefined && motion !== null) lines.push(`  - if picked for a video: ${motion}`);
    }
    if (videos.length > 0) lines.push("", `### ${collection} videos (${videos.length})`, "");
    for (const job of videos) {
      const model = VIDEO_MODELS[job.model];
      const preset = job.cameraPreset === undefined ? "" : `, preset \`${job.cameraPreset}\``;
      lines.push(`- \`${job.key}\` from \`${job.source}\` · ${model.name} ${model.resolution}, ${job.durationSec} s${preset}: ${job.prompt}`);
    }
    if (picks !== undefined) lines.push("", `Plus ${picks.count} videos from images picked on the contact sheet (${VIDEO_MODELS[picks.model].name}).`);
  }
  return `${lines.join("\n")}\n`;
}

const plan = buildMediaPlan();
printEstimate(costRows(plan), plan, await readLog(LOG_PATH));
await mkdir(path.dirname(REVIEW_PATH), { recursive: true });
await writeFile(REVIEW_PATH, reviewFile(plan));
console.log(`\nEvery prompt: ${REVIEW_PATH}`);
