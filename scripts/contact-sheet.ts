// A review page of generated media (the media plan's contact sheet): every job with its key,
// model, cost and prompt, grouped by collection, failures included. Small copies of the images
// and clips are embedded, so the page is one file that opens anywhere.
//
// Usage: pnpm media:sheet --test | --second-test | --all | --collection <name> | --only <keys>,
// optionally with --images → media-src/real/contact-sheet-<name>.html
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { promisify } from "node:util";
import sharp from "sharp";
import { fingerprint, inputsOf, jobCost, readLog, selectJobs, summarize, type Job, type JobState } from "./generation.ts";
import { IMAGE_MODELS, VIDEO_MODELS } from "./higgsfield-models.ts";
import { mapConcurrent } from "./pool.ts";
import { buildMediaPlan, COLLECTIONS } from "./prompts.ts";

const run = promisify(execFile);
const OUT_DIR = "media-src/real";
const LOG_PATH = `${OUT_DIR}/generation-log.jsonl`;
const THUMB_WIDTH = 480;
const TITLES: Record<string, string> = { test: "Test run", "second-test": "Second test" };

const escape = (text: string) => text.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char);

/** A small copy of a finished file, as a data URL: a JPEG for images, a 360p MP4 for videos. */
async function preview(job: Job, file: string): Promise<string> {
  if (job.kind === "image") {
    const jpeg = await sharp(file).resize({ width: THUMB_WIDTH, withoutEnlargement: true }).jpeg({ quality: 72 }).toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  }
  const dir = await mkdtemp(path.join(tmpdir(), "sheet-"));
  try {
    const out = path.join(dir, "clip.mp4");
    await run("ffmpeg", ["-y", "-loglevel", "error", "-i", file, "-vf", "scale=-2:360", "-c:v", "libx264", "-crf", "30", "-preset", "veryfast", "-an", "-movflags", "+faststart", out]);
    return `data:video/mp4;base64,${(await readFile(out)).toString("base64")}`;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function card(job: Job, state: JobState | undefined, media: string | null, earlier: boolean): string {
  const model = job.kind === "image" ? IMAGE_MODELS[job.model] : VIDEO_MODELS[job.model];
  const inputs = inputsOf(job);
  const status = state === undefined ? "not made" : state.status === "completed" ? `$${jobCost(job).toFixed(4)}` : state.status;
  // The caption shows today's prompt; say so when the file was made from an older one.
  const notes = [
    ...(earlier ? ["earlier result, for comparison"] : []),
    ...(state?.status === "completed" && state.fingerprint !== fingerprint(job) ? ["made from an earlier prompt"] : []),
  ];
  const visual =
    media === null
      ? `<div class="missing">${escape(status)}</div>`
      : job.kind === "image"
        ? `<img src="${media}" alt="">`
        : `<video src="${media}" autoplay muted loop playsinline controls></video>`;
  const details = [
    job.kind === "image" ? job.aspectRatio : `${job.durationSec} s`,
    `${model.name} ${model.resolution}`,
    status,
    ...(job.kind === "image" && job.seed !== undefined ? [`seed ${job.seed}`] : []),
    ...(job.kind === "video" && job.cameraPreset !== undefined ? [`preset ${job.cameraPreset}`] : []),
    ...notes,
  ];
  return `<figure>${visual}<figcaption><b>${escape(job.key)}</b><span>${escape(details.join(" · "))}</span>${
    inputs.length > 0 ? `<span>from ${escape(inputs.join(", "))}</span>` : ""
  }<p>${escape(job.prompt)}</p></figcaption></figure>`;
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      test: { type: "boolean", default: false },
      "second-test": { type: "boolean", default: false },
      all: { type: "boolean", default: false },
      collection: { type: "string" },
      only: { type: "string" },
      images: { type: "boolean", default: false },
    },
  });
  const plan = buildMediaPlan();
  const { name, jobs, shownWith: earlier } = selectJobs(plan, values);
  const title = TITLES[name] ?? name;
  const shown = [...earlier, ...jobs];

  const states = summarize(await readLog(LOG_PATH));
  const media = await mapConcurrent(shown, 4, async (job) => {
    const state = states.get(job.key);
    return state?.status === "completed" && state.file !== undefined && existsSync(state.file) ? preview(job, state.file) : null;
  });
  const made = jobs.filter((job) => states.get(job.key)?.status === "completed").length;
  const spent = jobs.reduce((sum, job) => sum + (states.get(job.key)?.status === "completed" ? jobCost(job) : 0), 0);

  const sections = COLLECTIONS.map((collection) => {
    const cards = shown.flatMap((job, i) => (job.collection === collection ? [card(job, states.get(job.key), media[i], i < earlier.length)] : []));
    return cards.length === 0 ? "" : `<h2>${collection} (${cards.length})</h2><div class="grid">${cards.join("")}</div>`;
  }).join("");

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} · contact sheet</title><style>
:root{color-scheme:dark}body{margin:0;padding:16px;background:#0b0b0c;color:#f2f2f3;font:14px/1.4 system-ui,sans-serif}
h1{font-size:20px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 10px}.summary{color:#a8a8b0;margin:0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
figure{margin:0;background:#141416;border-radius:8px;overflow:hidden}img,video{display:block;width:100%;height:auto;background:#1d1d20}
.missing{display:grid;place-items:center;aspect-ratio:16/9;background:#2a1a1d;color:#ff6b81}
figcaption{padding:8px 10px 10px;display:grid;gap:2px}figcaption span{color:#a8a8b0;font-size:12px}figcaption p{margin:4px 0 0;font-size:12px;color:#d0d0d5}
</style></head><body><h1>${escape(title)}: contact sheet</h1>
<p class="summary">${made} of ${jobs.length} made · about $${spent.toFixed(2)} at today's prices · AI-generated media, local review only</p>
${sections}</body></html>`;
  const sheetPath = `${OUT_DIR}/contact-sheet-${name}.html`;
  await writeFile(sheetPath, html);
  console.log(`${sheetPath}: ${made} of ${jobs.length} made, ${(html.length / 1024 / 1024).toFixed(1)} MB`);
}

await main();
