// Running generation jobs without paying twice or overspending:
// - Every request goes into an append-only log. A stopped run picks up where it was: finished
//   jobs are skipped, and a request already submitted is polled, not sent again.
// - Each job sends its key as the Idempotency-Key, so even a resent request isn't charged twice.
//   A retry after a failure gets a new key ("key~2"), or the API would replay the failure.
// - A job starts only once the images it needs exist, and only while the run's spend, counting
//   the requests still in flight, stays within the cap.
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { imageCost, videoCost } from "./higgsfield-models.ts";
import {
  ENDPOINTS,
  FINAL_STATES,
  HiggsfieldError,
  imageRequest,
  videoRequest,
  type HiggsfieldApi,
  type RequestState,
  type RequestStatus,
} from "./higgsfield.ts";
import { COLLECTIONS, type ImageJob, type MediaPlan, type VideoJob } from "./prompts.ts";
import { secondTestJobs, secondTestShownWith, testRunJobs } from "./test-run.ts";

export type Job = ImageJob | VideoJob;

/** Higgsfield keeps outputs at least 7 days; an input older than this is not trusted. */
const INPUT_MAX_AGE_MS = 6 * 24 * 60 * 60 * 1000;
const POLL_MS = { image: 3_000, video: 10_000 };
const TIMEOUT_MS = { image: 20 * 60_000, video: 60 * 60_000 };
const RETRY_DELAYS_MS = [2_000, 4_000, 8_000, 16_000, 30_000, 30_000];

/** What a job costs at today's (sale) prices. */
export function jobCost(job: Job): number {
  return job.kind === "image" ? imageCost(job.model, job.references?.length ?? 0, "sale") : videoCost(job.model, job.durationSec, "sale");
}

/** The keys of the images a job starts from. */
export function inputsOf(job: Job): string[] {
  return job.kind === "image" ? (job.references ?? []) : [job.source];
}

/** The plan's jobs that `wanted` picks, plus the images they start from, in plan order. */
function withInputs(plan: MediaPlan, wanted: (job: Job) => boolean): Job[] {
  const all: Job[] = [...plan.images, ...plan.videos];
  const byKey = new Map(all.map((job) => [job.key, job]));
  const needed = new Set<string>();
  const add = (key: string) => {
    if (needed.has(key)) return;
    needed.add(key);
    const job = byKey.get(key);
    if (job !== undefined) inputsOf(job).forEach(add);
  };
  all.filter(wanted).forEach((job) => add(job.key));
  return all.filter((job) => needed.has(job.key));
}

export interface Selection {
  /** "test", "second-test", "all", "only" or the collection's name, plus "-images"; names the contact sheet. */
  name: string;
  jobs: Job[];
  /** Earlier results the contact sheet shows next to these jobs, for comparison. */
  shownWith: Job[];
}

export interface SelectionFlags {
  test: boolean;
  "second-test": boolean;
  all: boolean;
  collection?: string;
  /** Job keys, comma-separated. */
  only?: string;
  /** Keep only the image jobs, so images are reviewed before any video is made from them. */
  images: boolean;
}

/**
 * The jobs the command line asks for: a test run, the whole plan, a collection, or named jobs.
 * A collection or named jobs come with the images they start from.
 */
export function selectJobs(plan: MediaPlan, flags: SelectionFlags): Selection {
  const sources = [flags.test, flags["second-test"], flags.all, flags.collection !== undefined, flags.only !== undefined];
  if (sources.filter(Boolean).length !== 1) {
    throw new Error(`Pass one of --test, --second-test, --all, --collection <${COLLECTIONS.join("|")}> or --only <keys>.`);
  }
  const selection = selectSource(plan, flags);
  return flags.images
    ? { ...selection, name: `${selection.name}-images`, jobs: selection.jobs.filter((job) => job.kind === "image") }
    : selection;
}

function selectSource(plan: MediaPlan, flags: SelectionFlags): Selection {
  if (flags.test) return { name: "test", jobs: testRunJobs(plan), shownWith: [] };
  if (flags["second-test"]) return { name: "second-test", jobs: secondTestJobs(plan), shownWith: secondTestShownWith(plan) };
  if (flags.all) return { name: "all", jobs: [...plan.images, ...plan.videos], shownWith: [] };
  if (flags.only !== undefined) {
    const keys = new Set(flags.only.split(",").map((key) => key.trim()).filter((key) => key !== ""));
    const known = new Set([...plan.images, ...plan.videos].map((job) => job.key));
    const unknown = [...keys].filter((key) => !known.has(key));
    if (keys.size === 0 || unknown.length > 0) throw new Error(`--only needs job keys from the plan; not in it: ${unknown.join(", ") || "(none given)"}`);
    return { name: "only", jobs: withInputs(plan, (job) => keys.has(job.key)), shownWith: [] };
  }
  const collection = COLLECTIONS.find((name) => name === flags.collection);
  if (collection === undefined) throw new Error(`No collection "${flags.collection}"; pick one of ${COLLECTIONS.join(", ")}.`);
  return { name: collection, jobs: withInputs(plan, (job) => job.collection === collection), shownWith: [] };
}

/**
 * What a job asks for. Input URLs are left out: they change if an input is made again. The seed
 * is in only when set, so jobs without one keep the fingerprints already in the log.
 */
export function fingerprint(job: Job): string {
  const asked =
    job.kind === "image"
      ? {
          kind: job.kind,
          model: job.model,
          prompt: job.prompt,
          ratio: job.aspectRatio,
          inputs: inputsOf(job),
          ...(job.seed === undefined ? {} : { seed: job.seed }),
        }
      : { kind: job.kind, model: job.model, prompt: job.prompt, inputs: inputsOf(job), seconds: job.durationSec, preset: job.cameraPreset ?? null };
  return createHash("sha256").update(JSON.stringify(asked)).digest("hex").slice(0, 16);
}

export function idempotencyKey(key: string, attempt: number): string {
  return attempt === 1 ? key : `${key}~${attempt}`;
}

const stateSchema = z.enum(["queued", "in_progress", "nsfw", "failed", "completed", "canceled"]);

const logEntrySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("submitted"),
    key: z.string(),
    attempt: z.number().int().positive(),
    fingerprint: z.string(),
    requestId: z.string(),
    costUsd: z.number(),
    at: z.string(),
  }),
  z.object({
    type: z.literal("finished"),
    key: z.string(),
    attempt: z.number().int().positive(),
    fingerprint: z.string(),
    requestId: z.string(),
    status: stateSchema,
    /** What it cost: the price if completed, 0 if failed (refunded) or never accepted. */
    costUsd: z.number(),
    outputUrl: z.string().optional(),
    file: z.string().optional(),
    error: z.string().optional(),
    at: z.string(),
  }),
  /** A finished result rejected in review: the next run makes the job again, as a new attempt. */
  z.object({
    type: z.literal("discarded"),
    key: z.string(),
    attempt: z.number().int().positive(),
    reason: z.string(),
    at: z.string(),
  }),
]);

export type LogEntry = z.infer<typeof logEntrySchema>;

/** A job's latest attempt, from the log. */
export interface JobState {
  attempt: number;
  fingerprint: string;
  requestId: string;
  status: "in-flight" | "discarded" | RequestState;
  costUsd: number;
  outputUrl?: string;
  file?: string;
  finishedAt?: string;
}

export function summarize(entries: readonly LogEntry[]): Map<string, JobState> {
  const states = new Map<string, JobState>();
  for (const entry of entries) {
    if (entry.type === "submitted") {
      states.set(entry.key, {
        attempt: entry.attempt,
        fingerprint: entry.fingerprint,
        requestId: entry.requestId,
        status: "in-flight",
        costUsd: entry.costUsd,
      });
    } else if (entry.type === "discarded") {
      const state = states.get(entry.key);
      if (state !== undefined) states.set(entry.key, { ...state, status: "discarded" });
    } else {
      states.set(entry.key, {
        attempt: entry.attempt,
        fingerprint: entry.fingerprint,
        requestId: entry.requestId,
        status: entry.status,
        costUsd: entry.costUsd,
        outputUrl: entry.outputUrl,
        file: entry.file,
        finishedAt: entry.at,
      });
    }
  }
  return states;
}

/**
 * Money spent so far: every completed request, including results discarded later (they were
 * paid for). Failed and refused requests are refunded.
 */
export function totalSpent(entries: readonly LogEntry[]): number {
  return entries.reduce((sum, entry) => sum + (entry.type === "finished" && entry.status === "completed" ? entry.costUsd : 0), 0);
}

/** Marks finished results as rejected, so the next run makes them again. Returns the keys marked. */
export async function discard(logPath: string, keys: readonly string[], reason: string, now: Date): Promise<string[]> {
  const states = summarize(await readLog(logPath));
  const marked = keys.filter((key) => states.get(key)?.status === "completed");
  for (const key of marked) {
    const entry: LogEntry = { type: "discarded", key, attempt: states.get(key)?.attempt ?? 1, reason, at: now.toISOString() };
    await appendFile(logPath, `${JSON.stringify(entry)}\n`);
  }
  return marked;
}

export async function readLog(logPath: string): Promise<LogEntry[]> {
  if (!existsSync(logPath)) return [];
  const lines = (await readFile(logPath, "utf8")).split("\n").filter((line) => line.trim() !== "");
  return lines.map((line) => logEntrySchema.parse(JSON.parse(line)));
}

export interface RunOptions {
  /** In dependency order: inputs before the jobs that use them. */
  jobs: readonly Job[];
  /** Every image job of the plan: a video's frame shape comes from its source image. */
  images: ReadonlyMap<string, ImageJob>;
  api: HiggsfieldApi;
  logPath: string;
  outDir: string;
  maxSpend: number;
  concurrency: number;
  sleep: (ms: number) => Promise<void>;
  now: () => Date;
  report: (line: string) => void;
}

export interface RunResult {
  completed: string[];
  failed: { key: string; status: string; error?: string }[];
  /** Jobs not started: an input is missing, or the cap was reached. */
  notStarted: { key: string; reason: string }[];
  /** This run's spend, at today's prices. */
  spent: number;
}

/** Thrown for problems no retry fixes: a wrong key, no balance. The run stops. */
export class RunStopped extends Error {}

const usd = (amount: number) => `$${amount.toFixed(4)}`;

function extensionFor(url: string, contentType: string, kind: Job["kind"]): string {
  const fromUrl = path.extname(new URL(url).pathname).toLowerCase();
  if (/^\.(png|jpe?g|webp|mp4|mov)$/.test(fromUrl)) return fromUrl;
  const fromType = { "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp", "video/mp4": ".mp4" }[contentType.split(";")[0]];
  return fromType ?? (kind === "video" ? ".mp4" : ".png");
}

export async function runJobs(options: RunOptions): Promise<RunResult> {
  const { jobs, images, api, logPath, outDir, maxSpend, concurrency, sleep, now, report } = options;
  await mkdir(path.dirname(logPath), { recursive: true });
  const states = summarize(await readLog(logPath));

  // A finished job whose prompt has changed since: never redone silently, it would cost again.
  for (const job of jobs) {
    const state = states.get(job.key);
    if (state?.status === "completed" && state.fingerprint !== fingerprint(job)) {
      throw new RunStopped(
        `${job.key} was made from a different request than the plan now has. To make it again, discard it first: pnpm media:generate --discard ${job.key}`,
      );
    }
  }

  const result: RunResult = { completed: [], failed: [], notStarted: [], spent: 0 };
  /** Spend this run has committed to: its completed jobs plus its requests still in flight. */
  let committed = 0;
  const committedKeys = new Set<string>();
  const release = (job: Job) => {
    if (committedKeys.delete(job.key)) committed -= jobCost(job);
  };
  /** Keys being made right now: their dependents wait for them. */
  const runningKeys = new Set<string>();
  const outputs = new Map<string, { url: string; at: Date }>();
  for (const [key, state] of states) {
    if (state.status === "completed" && state.outputUrl !== undefined && state.finishedAt !== undefined) {
      outputs.set(key, { url: state.outputUrl, at: new Date(state.finishedAt) });
    }
  }

  async function log(entry: LogEntry): Promise<void> {
    await appendFile(logPath, `${JSON.stringify(entry)}\n`);
  }

  async function withRetry<T>(request: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try {
        return await request();
      } catch (error) {
        const retryable = error instanceof HiggsfieldError ? error.retry : error instanceof TypeError; // TypeError: network failure
        if (error instanceof HiggsfieldError && [401, 402, 403].includes(error.httpStatus)) {
          throw new RunStopped(`Higgsfield refused the request (${error.message}). Check the key and the balance.`);
        }
        if (!retryable || attempt >= RETRY_DELAYS_MS.length) throw error;
        await sleep(RETRY_DELAYS_MS[attempt]);
      }
    }
  }

  async function finish(job: Job, attempt: number, requestId: string, status: RequestStatus): Promise<void> {
    const at = now().toISOString();
    const base = { type: "finished" as const, key: job.key, attempt, fingerprint: fingerprint(job), requestId, at };
    if (status.status !== "completed") {
      await log({ ...base, status: status.status, costUsd: 0, error: status.error ?? undefined });
      release(job);
      result.failed.push({ key: job.key, status: status.status, error: status.error ?? undefined });
      report(`  ✗ ${job.key}: ${status.status}${status.error ? ` (${status.error})` : ""}`);
      return;
    }
    const url = status.images?.[0]?.url ?? status.video?.url;
    if (url === undefined) throw new Error(`${job.key} completed without an output URL`);
    // Higgsfield keeps outputs for about 7 days: download right away.
    const download = await withRetry(() => api.download(url));
    const file = path.join(outDir, job.collection, `${job.key}${extensionFor(url, download.contentType, job.kind)}`);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, download.bytes);
    await log({ ...base, status: "completed", costUsd: jobCost(job), outputUrl: url, file });
    outputs.set(job.key, { url, at: now() });
    result.completed.push(job.key);
    result.spent += jobCost(job);
    report(`  ✓ ${job.key} → ${file}`);
  }

  async function poll(job: Job, attempt: number, requestId: string): Promise<void> {
    const started = now().getTime();
    for (;;) {
      const status = await withRetry(() => api.status(requestId));
      if (FINAL_STATES.has(status.status)) return finish(job, attempt, requestId, status);
      if (now().getTime() - started > TIMEOUT_MS[job.kind]) {
        // Left in flight in the log: the next run polls it again instead of paying again.
        result.notStarted.push({ key: job.key, reason: `still ${status.status} after the timeout; the next run picks it up` });
        report(`  … ${job.key}: still ${status.status}, left for the next run`);
        return;
      }
      await sleep(POLL_MS[job.kind]);
    }
  }

  async function submit(job: Job, attempt: number): Promise<void> {
    const inputs = inputsOf(job).map((key) => outputs.get(key)?.url ?? "");
    const body =
      job.kind === "image" ? imageRequest(job, inputs) : videoRequest(job, inputs[0], images.get(job.source)?.aspectRatio ?? "16:9");
    let accepted: RequestStatus;
    try {
      accepted = await withRetry(() => api.submit(ENDPOINTS[job.model], body, idempotencyKey(job.key, attempt)));
    } catch (error) {
      if (!(error instanceof HiggsfieldError)) throw error;
      // Refused before it started (a bad field, say): nothing was charged.
      release(job);
      await log({ type: "finished", key: job.key, attempt, fingerprint: fingerprint(job), requestId: "", status: "failed", costUsd: 0, error: error.message, at: now().toISOString() });
      result.failed.push({ key: job.key, status: "refused", error: error.message });
      report(`  ✗ ${job.key}: refused (${error.message})`);
      return;
    }
    await log({
      type: "submitted",
      key: job.key,
      attempt,
      fingerprint: fingerprint(job),
      requestId: accepted.request_id,
      costUsd: jobCost(job),
      at: now().toISOString(),
    });
    report(`  → ${job.key} (${usd(jobCost(job))})`);
    if (FINAL_STATES.has(accepted.status)) return finish(job, attempt, accepted.request_id, accepted);
    return poll(job, attempt, accepted.request_id);
  }

  // What each job still needs: nothing (done), polling (in flight), or a new attempt.
  type Work = { job: Job; resume?: JobState; attempt: number };
  const pending: Work[] = [];
  for (const job of jobs) {
    const state = states.get(job.key);
    if (state?.status === "completed") continue;
    if (state?.status === "in-flight") pending.push({ job, resume: state, attempt: state.attempt });
    else pending.push({ job, attempt: (state?.attempt ?? 0) + 1 });
  }

  const running = new Set<Promise<void>>();
  /** The first error no retry fixes; the run stops once the requests in flight settle. */
  let fatal: unknown = null;
  const failedKeys = () => new Set(result.failed.map((failure) => failure.key));

  const ready = (work: Work): boolean | string => {
    for (const input of inputsOf(work.job)) {
      if (failedKeys().has(input)) return `its input ${input} failed`;
      const output = outputs.get(input);
      if (output === undefined) {
        const inThisRun = runningKeys.has(input) || pending.some((other) => other.job.key === input);
        return inThisRun ? false : `its input ${input} doesn't exist yet`;
      }
      if (now().getTime() - output.at.getTime() > INPUT_MAX_AGE_MS) return `its input ${input} is older than 6 days`;
    }
    return true;
  };

  while (pending.length > 0 || running.size > 0) {
    let capReached = false;
    for (let i = 0; i < pending.length && running.size < concurrency; ) {
      const work = pending[i];
      const status = work.resume !== undefined ? true : ready(work);
      if (typeof status === "string") {
        result.notStarted.push({ key: work.job.key, reason: status });
        pending.splice(i, 1);
        continue;
      }
      if (!status) {
        i++;
        continue;
      }
      if (work.resume === undefined && committed + jobCost(work.job) > maxSpend + 1e-9) {
        capReached = true;
        break;
      }
      pending.splice(i, 1);
      if (work.resume === undefined) {
        committed += jobCost(work.job);
        committedKeys.add(work.job.key);
      }
      runningKeys.add(work.job.key);
      const task: Promise<void> =
        work.resume !== undefined ? poll(work.job, work.attempt, work.resume.requestId) : submit(work.job, work.attempt);
      const tracked = task
        .catch((error: unknown) => {
          fatal ??= error;
        })
        .finally(() => {
          running.delete(tracked);
          runningKeys.delete(work.job.key);
        });
      running.add(tracked);
    }
    if (capReached && running.size === 0) break;
    if (running.size === 0) {
      // Nothing running and nothing startable: whatever is left waits on inputs that never came.
      for (const work of pending) result.notStarted.push({ key: work.job.key, reason: "its inputs weren't made" });
      pending.length = 0;
      break;
    }
    await Promise.race(running);
    if (fatal !== null) {
      await Promise.allSettled(running);
      throw fatal;
    }
  }

  for (const work of pending) {
    result.notStarted.push({ key: work.job.key, reason: `the run would pass the ${usd(maxSpend)} cap` });
  }
  return result;
}
