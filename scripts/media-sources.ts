// Lists the real media for `pnpm media:ingest`: every job of the media plan, from the file its
// latest accepted result left (the generation log, scripts/generation.ts), with the optional
// manifest fields (SPEC 4.2). createdAt is when that result was made, so the Feed's
// newest-first order is the real order of making.
//
// Usage: pnpm media:sources   → media-src/real/sources.json
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fingerprint, readLog, summarize, type Job, type JobState } from "./generation.ts";
import { IMAGE_MODELS, VIDEO_MODELS } from "./higgsfield-models.ts";
import { buildMediaPlan, USED_BY, type MediaPlan } from "./prompts.ts";
import { sourcesSchema, type SourceItem } from "./sources.ts";

const OUT_DIR = "media-src/real";
const LOG_PATH = `${OUT_DIR}/generation-log.jsonl`;

/** Made, but kept out of the Feed (Agzhan's call, 2026-10-17). */
export const LEFT_OUT: Readonly<Record<string, string>> = {
  "worlds-487": "a small name plate on the boat",
  "worlds-544": "a small name plate on the boat",
  "camera-moves-snow-leopard-statue-dolly-out": "fake lettering on the plaque the move reveals",
};

/**
 * One source per plan job, minus the ones left out. Every job must have a result made from the
 * request the plan has now: a missing or outdated one stops the list, rather than putting an
 * old picture next to a new prompt.
 */
export function buildSources(plan: MediaPlan, states: ReadonlyMap<string, JobState>, sourceDir: string): SourceItem[] {
  const fileOf = (job: Job): string => {
    const state = states.get(job.key);
    if (state?.status !== "completed" || state.file === undefined || state.finishedAt === undefined) {
      throw new Error(`${job.key} has no accepted result yet`);
    }
    if (state.fingerprint !== fingerprint(job)) throw new Error(`${job.key} was made from an older request`);
    return path.relative(sourceDir, state.file);
  };
  const images = new Map(plan.images.map((job) => [job.key, job]));
  return [...plan.images, ...plan.videos]
    .filter((job) => LEFT_OUT[job.key] === undefined)
    .map((job): SourceItem => {
      const model = job.kind === "image" ? IMAGE_MODELS[job.model] : VIDEO_MODELS[job.model];
      const source = job.kind === "video" ? images.get(job.source) : undefined;
      return {
        file: fileOf(job),
        kind: job.kind,
        prompt: job.prompt,
        model: model.name,
        modelSlug: model.slug,
        createdAt: states.get(job.key)?.finishedAt ?? "",
        collection: job.collection,
        usedBy: [...USED_BY[job.collection]],
        ...(job.kind === "image"
          ? { shot: job.shot, pairId: job.pairId, variant: job.variant, ratioGroup: job.ratioGroup }
          : { cameraMove: job.cameraMove, shot: job.shot, sourceFile: source === undefined ? undefined : fileOf(source) }),
      };
    })
    .map((item) => Object.fromEntries(Object.entries(item).filter(([, value]) => value !== undefined)) as SourceItem);
}

async function main(): Promise<void> {
  const plan = buildMediaPlan();
  const sources = sourcesSchema.parse(buildSources(plan, summarize(await readLog(LOG_PATH)), OUT_DIR));
  const file = path.join(OUT_DIR, "sources.json");
  await writeFile(file, `${JSON.stringify(sources, null, 2)}\n`);
  const videos = sources.filter((source) => source.kind === "video").length;
  console.log(`${file}: ${sources.length - videos} images and ${videos} videos; left out: ${Object.keys(LEFT_OUT).join(", ")}`);
}

if (import.meta.main) await main();
