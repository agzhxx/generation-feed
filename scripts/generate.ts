// Generates M5's media with the Higgsfield API (scripts/generation.ts explains the safeguards).
// Files land in media-src/real/<collection>/, and every request is logged to
// media-src/real/generation-log.jsonl (local only, like the rest of media-src/).
//
// Usage:
//   pnpm media:generate --test --dry-run                 what the test run would send and cost
//   pnpm media:generate --test --max-spend 2             the test run (needs HIGGSFIELD_API_KEY in .env.local)
//   pnpm media:generate --second-test --dry-run          the same for the second test
//   pnpm media:generate --collection worlds --dry-run    the same for one collection
//   pnpm media:generate --all --images --dry-run         every image of the plan
//   pnpm media:generate --only key1,key2 --dry-run       named jobs (and the images they start from)
//   pnpm media:generate --discard worlds-002,worlds-010 --reason "text in the image"
//                                                        reject finished results; the next run makes them again
//
// A paid run needs --max-spend: it stops starting jobs before this run would spend more.
// Check the prices in scripts/higgsfield-models.ts before every paid run.
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { IMAGE_MODELS, PRICES_CHECKED, VIDEO_MODELS } from "./higgsfield-models.ts";
import { createApi, ENDPOINTS, imageRequest, videoRequest } from "./higgsfield.ts";
import { discard, fingerprint, inputsOf, jobCost, readLog, runJobs, selectJobs, summarize, totalSpent, type Job } from "./generation.ts";
import { buildMediaPlan, type ImageJob } from "./prompts.ts";

const OUT_DIR = "media-src/real";
const LOG_PATH = `${OUT_DIR}/generation-log.jsonl`;
/** Requests in flight at once; the account allows more, but the docs suggest staying well below. */
const CONCURRENCY = 4;

const usd = (amount: number) => `$${amount.toFixed(2)}`;

function modelName(job: Job): string {
  const model = job.kind === "image" ? IMAGE_MODELS[job.model] : VIDEO_MODELS[job.model];
  return `${model.name} ${model.resolution}`;
}

function dryRun(jobs: readonly Job[], images: ReadonlyMap<string, ImageJob>, done: ReadonlySet<string>, changed: ReadonlySet<string>): void {
  for (const job of jobs) {
    const inputs = inputsOf(job).map((key) => `<${key}>`);
    const body = job.kind === "image" ? imageRequest(job, inputs) : videoRequest(job, inputs[0], images.get(job.source)?.aspectRatio ?? "16:9");
    const status = done.has(job.key) ? "done" : changed.has(job.key) ? "changed since it was made: discard it first" : `$${jobCost(job).toFixed(4)}`;
    console.log(`${job.key} · ${modelName(job)} · ${status}\n  POST /${ENDPOINTS[job.model]} ${JSON.stringify(body)}`);
  }
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
      "dry-run": { type: "boolean", default: false },
      "max-spend": { type: "string" },
      discard: { type: "string" },
      reason: { type: "string", default: "rejected in review" },
    },
  });
  if (values.discard !== undefined) {
    const keys = values.discard.split(",").map((key) => key.trim()).filter((key) => key !== "");
    const marked = await discard(LOG_PATH, keys, values.reason, new Date());
    console.log(`Discarded ${marked.length}: ${marked.join(", ")}. The next run makes them again.`);
    const skipped = keys.filter((key) => !marked.includes(key));
    if (skipped.length > 0) console.log(`Not discarded, no finished result in the log: ${skipped.join(", ")}`);
    return;
  }

  const plan = buildMediaPlan();
  const { jobs } = selectJobs(plan, values);
  const images = new Map(plan.images.map((job) => [job.key, job]));
  const entries = await readLog(LOG_PATH);
  const states = summarize(entries);
  const made = jobs.filter((job) => states.get(job.key)?.status === "completed");
  const done = new Set(made.filter((job) => states.get(job.key)?.fingerprint === fingerprint(job)).map((job) => job.key));
  const changed = new Set(made.filter((job) => !done.has(job.key)).map((job) => job.key));
  const todo = jobs.filter((job) => !done.has(job.key) && !changed.has(job.key));
  const cost = todo.reduce((sum, job) => sum + jobCost(job), 0);
  console.log(`Prices checked ${PRICES_CHECKED}.`);
  console.log(`${jobs.length} jobs: ${done.size} done, ${todo.length} to make, about ${usd(cost)}. Spent so far by the log: ${usd(totalSpent(entries))} (the console has the real figure).`);
  if (changed.size > 0) console.log(`Changed since they were made (discard them to make them again): ${[...changed].join(", ")}`);
  console.log("");

  if (values["dry-run"]) {
    dryRun(jobs, images, done, changed);
    return;
  }
  const maxSpend = Number(values["max-spend"]);
  if (!(maxSpend > 0)) throw new Error("A paid run needs --max-spend <dollars>.");
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const credentials = process.env.HIGGSFIELD_API_KEY ?? "";
  if (!credentials.includes(":")) throw new Error('Set HIGGSFIELD_API_KEY="<key id>:<key secret>" in .env.local first.');

  const result = await runJobs({
    jobs,
    images,
    api: createApi(credentials),
    logPath: LOG_PATH,
    outDir: OUT_DIR,
    maxSpend,
    concurrency: CONCURRENCY,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => new Date(),
    report: (line) => console.log(line),
  });

  const after = await readLog(LOG_PATH);
  console.log(`\nMade ${result.completed.length}, failed ${result.failed.length} (failures are refunded), not started ${result.notStarted.length}.`);
  for (const { key, status, error } of result.failed) console.log(`  failed  ${key}: ${status}${error ? ` (${error})` : ""}`);
  for (const { key, reason } of result.notStarted) console.log(`  waiting ${key}: ${reason}`);
  console.log(`This run: about ${usd(result.spent)}. All runs (log): about ${usd(totalSpent(after))}. Compare with the balance in the Higgsfield console.`);
}

await main();
