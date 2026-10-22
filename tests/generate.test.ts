import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  discard,
  fingerprint,
  idempotencyKey,
  inputsOf,
  jobCost,
  readLog,
  RunStopped,
  runJobs,
  selectJobs,
  summarize,
  type SelectionFlags,
  totalSpent,
  type Job,
  type LogEntry,
  type RunOptions,
} from "@/scripts/generation";
import { ENDPOINTS, HiggsfieldError, imageRequest, videoRequest, type HiggsfieldApi, type RequestStatus } from "@/scripts/higgsfield";
import { buildMediaPlan, type ImageJob, type VideoJob } from "@/scripts/prompts";
import { secondTestJobs, secondTestShownWith, testRunJobs } from "@/scripts/test-run";

const plan = buildMediaPlan();
const image = (key: string): ImageJob => plan.images.find((job) => job.key === key)!;
const video = (key: string): VideoJob => plan.videos.find((job) => job.key === key)!;

type Outcome = "completed" | "failed" | "nsfw" | "refused";

/** A pretend Higgsfield: requests finish on their first status check, with the outcome set per key. */
class FakeApi implements HiggsfieldApi {
  submitted: { endpoint: string; body: Record<string, unknown>; key: string }[] = [];
  statusChecks: string[] = [];
  outcomes = new Map<string, Outcome>();

  async submit(endpoint: string, body: Record<string, unknown>, key: string): Promise<RequestStatus> {
    const jobKey = key.split("~")[0];
    if (this.outcomes.get(jobKey) === "refused") throw new HiggsfieldError("HTTP 422: bad field", 422, false);
    this.submitted.push({ endpoint, body, key });
    return { status: "queued", request_id: `req-${key}` };
  }

  async status(requestId: string): Promise<RequestStatus> {
    this.statusChecks.push(requestId);
    const jobKey = requestId.replace(/^req-/, "").split("~")[0];
    const outcome = this.outcomes.get(jobKey) ?? "completed";
    if (outcome !== "completed") return { status: outcome === "nsfw" ? "nsfw" : "failed", request_id: requestId, error: "no luck" };
    const isVideo = plan.videos.some((job) => job.key === jobKey);
    return isVideo
      ? { status: "completed", request_id: requestId, video: { url: `https://cdn.example.com/${requestId}.mp4` } }
      : { status: "completed", request_id: requestId, images: [{ url: `https://cdn.example.com/${requestId}.png` }] };
  }

  async download(): Promise<{ bytes: Uint8Array; contentType: string }> {
    return { bytes: new Uint8Array([1, 2, 3]), contentType: "image/png" };
  }
}

let dir: string;
let api: FakeApi;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "generate-test-"));
  api = new FakeApi();
});
afterEach(() => rm(dir, { recursive: true, force: true }));

function run(jobs: Job[], overrides: Partial<RunOptions> = {}) {
  let clock = Date.parse("2026-10-17T10:00:00Z");
  return runJobs({
    jobs,
    images: new Map(plan.images.map((job) => [job.key, job])),
    api,
    logPath: path.join(dir, "log.jsonl"),
    outDir: dir,
    maxSpend: 5,
    concurrency: 4,
    sleep: async () => {},
    now: () => new Date((clock += 1000)),
    report: () => {},
    ...overrides,
  });
}

describe("request bodies", () => {
  test("Soul 2 sends our prompt as written, at the job's resolution", () => {
    const job = image("worlds-001");
    expect(ENDPOINTS[job.model]).toBe("higgsfield-ai/soul/v2/standard");
    expect(imageRequest(job, [])).toEqual({ prompt: job.prompt, aspect_ratio: job.aspectRatio, resolution: "1080p", batch_size: 1, enhance_prompt: false });
    expect(imageRequest(image("pairs-p01-draft"), [])).toMatchObject({ resolution: "720p" });
  });

  test("a seed goes out to Soul 2 only when the job has one, and only then changes the fingerprint", () => {
    const job = image("pairs-p02-draft");
    expect(imageRequest({ ...job, seed: 7 }, [])).toMatchObject({ seed: 7 });
    expect(imageRequest(job, [])).not.toHaveProperty("seed");
    expect(fingerprint({ ...job, seed: 7 })).not.toBe(fingerprint(job));
  });

  test("Grok gets its reference images at 2k, medium quality, and none when it has none", () => {
    expect(imageRequest(image("pairs-p01-final"), ["https://cdn.example.com/draft.png"])).toMatchObject({ image_urls: ["https://cdn.example.com/draft.png"], resolution: "2k" });
    expect(ENDPOINTS[image("story-02-medium").model]).toBe("xai/grok-imagine-image-2.0");
    expect(imageRequest(image("story-02-medium"), ["https://cdn.example.com/hero.png"])).toMatchObject({
      image_urls: ["https://cdn.example.com/hero.png"],
      quality: "medium",
      resolution: "2k",
      aspect_ratio: "16:9",
    });
    expect(imageRequest(image("story-00-hero"), [])).not.toHaveProperty("image_urls");
  });

  test("Kling animates its image; Cinema Studio gets the preset, single-shot pacing, no audio, 480p", () => {
    expect(videoRequest(video("camera-moves-lighthouse-dolly-in"), "https://cdn.example.com/a.png", "16:9")).toEqual({
      prompt: video("camera-moves-lighthouse-dolly-in").prompt,
      image_url: "https://cdn.example.com/a.png",
      duration: 5,
    });
    const preset = video("camera-moves-red-car-orbit");
    expect(ENDPOINTS[preset.model]).toBe("higgsfield/cinema-studio/4.0");
    expect(videoRequest(preset, "https://cdn.example.com/car.png", "16:9")).toEqual({
      prompt: preset.prompt,
      image_urls: ["https://cdn.example.com/car.png"],
      camera_movement: "drone-orbit",
      pacing: "single-shot",
      generate_audio: false,
      duration: 5,
      resolution: "480p",
      aspect_ratio: "16:9",
    });
  });
});

describe("the generation log", () => {
  test("a retry after a failure gets a new idempotency key", () => {
    expect(idempotencyKey("worlds-001", 1)).toBe("worlds-001");
    expect(idempotencyKey("worlds-001", 2)).toBe("worlds-001~2");
  });

  test("tracks each job's latest attempt and counts only completed requests as spent", () => {
    const entries: LogEntry[] = [
      { type: "submitted", key: "a", attempt: 1, fingerprint: "f", requestId: "r1", costUsd: 0.1, at: "t" },
      { type: "finished", key: "a", attempt: 1, fingerprint: "f", requestId: "r1", status: "failed", costUsd: 0, at: "t" },
      { type: "submitted", key: "a", attempt: 2, fingerprint: "f", requestId: "r2", costUsd: 0.1, at: "t" },
      { type: "finished", key: "a", attempt: 2, fingerprint: "f", requestId: "r2", status: "completed", costUsd: 0.1, outputUrl: "u", at: "t" },
      { type: "submitted", key: "b", attempt: 1, fingerprint: "g", requestId: "r3", costUsd: 0.2, at: "t" },
    ];
    const states = summarize(entries);
    expect(states.get("a")).toMatchObject({ attempt: 2, status: "completed", outputUrl: "u" });
    expect(states.get("b")).toMatchObject({ status: "in-flight", requestId: "r3" });
    expect(totalSpent(entries)).toBeCloseTo(0.1);
  });
});

describe("runJobs", () => {
  test("makes inputs first and hands their outputs to the jobs that use them", async () => {
    const result = await run([image("pairs-p01-draft"), image("pairs-p01-final")]);
    expect(result.completed).toEqual(["pairs-p01-draft", "pairs-p01-final"]);
    expect(api.submitted.map((request) => request.key)).toEqual(["pairs-p01-draft", "pairs-p01-final"]);
    expect(api.submitted[1].body.image_urls).toEqual(["https://cdn.example.com/req-pairs-p01-draft.png"]);
    expect(existsSync(path.join(dir, "pairs", "pairs-p01-final.png"))).toBe(true);
    expect(result.spent).toBeCloseTo(0.0032 + 0.08 + 0.01); // Grok adds $0.01 per reference image
  });

  test("a second run makes nothing again", async () => {
    await run([image("worlds-001"), image("worlds-002")]);
    api.submitted = [];
    const again = await run([image("worlds-001"), image("worlds-002")]);
    expect(api.submitted).toEqual([]);
    expect(again.completed).toEqual([]);
  });

  test("a request still in flight is polled, not sent again", async () => {
    const job = image("worlds-001");
    const inFlight: LogEntry = { type: "submitted", key: job.key, attempt: 1, fingerprint: fingerprint(job), requestId: "req-worlds-001", costUsd: 0.0057, at: "t" };
    await writeFile(path.join(dir, "log.jsonl"), `${JSON.stringify(inFlight)}\n`);
    const result = await run([job]);
    expect(api.submitted).toEqual([]);
    expect(api.statusChecks).toEqual(["req-worlds-001"]);
    expect(result.completed).toEqual(["worlds-001"]);
  });

  test("a failed job costs nothing, holds back the jobs made from it, and is retried with a new key", async () => {
    api.outcomes.set("pairs-p01-draft", "nsfw");
    const first = await run([image("pairs-p01-draft"), image("pairs-p01-final")]);
    expect(first.failed).toEqual([{ key: "pairs-p01-draft", status: "nsfw", error: "no luck" }]);
    expect(first.notStarted).toEqual([{ key: "pairs-p01-final", reason: "its input pairs-p01-draft failed" }]);
    expect(first.spent).toBe(0);

    api.outcomes.clear();
    const second = await run([image("pairs-p01-draft"), image("pairs-p01-final")]);
    expect(api.submitted.slice(-2).map((request) => request.key)).toEqual(["pairs-p01-draft~2", "pairs-p01-final"]);
    expect(second.completed).toHaveLength(2);
  });

  test("a request refused before it starts costs nothing and is logged", async () => {
    api.outcomes.set("worlds-001", "refused");
    const result = await run([image("worlds-001")]);
    expect(result.failed).toEqual([{ key: "worlds-001", status: "refused", error: "HTTP 422: bad field" }]);
    expect(totalSpent(await readLog(path.join(dir, "log.jsonl")))).toBe(0);
  });

  test("stops starting jobs before the run would pass its cap", async () => {
    const jobs = [image("worlds-001"), image("worlds-002"), image("worlds-003")];
    const result = await run(jobs, { maxSpend: 0.012 });
    expect(result.completed).toHaveLength(2);
    expect(result.notStarted).toEqual([{ key: "worlds-003", reason: "the run would pass the $0.0120 cap" }]);
  });

  test("never silently redoes a finished job whose request has changed", async () => {
    const job = image("worlds-001");
    const old: LogEntry = { type: "finished", key: job.key, attempt: 1, fingerprint: "an older prompt", requestId: "r", status: "completed", costUsd: 0.0057, outputUrl: "u", at: "2026-10-17T09:00:00Z" };
    await writeFile(path.join(dir, "log.jsonl"), `${JSON.stringify(old)}\n`);
    await expect(run([job])).rejects.toBeInstanceOf(RunStopped);
    expect(api.submitted).toEqual([]);
  });

  test("a discarded result is made again as a new attempt, even from a changed prompt; its spend still counts", async () => {
    const logPath = path.join(dir, "log.jsonl");
    const old: LogEntry = { type: "finished", key: "pairs-p01-draft", attempt: 1, fingerprint: "an older prompt", requestId: "r", status: "completed", costUsd: 0.0032, outputUrl: "https://cdn.example.com/old.png", at: "2026-10-17T09:00:00Z" };
    await writeFile(logPath, `${JSON.stringify(old)}\n`);
    expect(await discard(logPath, ["pairs-p01-draft", "worlds-001"], "text in the image", new Date())).toEqual(["pairs-p01-draft"]);
    expect(summarize(await readLog(logPath)).get("pairs-p01-draft")).toMatchObject({ status: "discarded", attempt: 1 });

    await run([image("pairs-p01-draft"), image("pairs-p01-final")]);
    expect(api.submitted.map((request) => request.key)).toEqual(["pairs-p01-draft~2", "pairs-p01-final"]);
    // The final starts from the new draft, never from the discarded one.
    expect(api.submitted[1].body.image_urls).toEqual(["https://cdn.example.com/req-pairs-p01-draft~2.png"]);
    expect(totalSpent(await readLog(logPath))).toBeCloseTo(0.0032 * 2 + 0.08 + 0.01);
  });

  test("a wrong key or an empty balance stops the whole run", async () => {
    api.submit = async () => {
      throw new HiggsfieldError("HTTP 402: insufficient balance", 402, false);
    };
    await expect(run([image("worlds-001")])).rejects.toBeInstanceOf(RunStopped);
  });
});

describe("the test run", () => {
  test("tries every model, puts inputs before the jobs that use them, and stays under $2", () => {
    const jobs = testRunJobs(plan);
    const models = new Set(jobs.map((job) => job.model));
    expect(models).toEqual(new Set(["soul-2-1080p", "soul-2-720p", "grok-imagine-2-2k", "kling-2.5-standard", "kling-2.5-pro", "cinema-studio-4-480p"]));
    const position = new Map(jobs.map((job, i) => [job.key, i]));
    for (const job of jobs) {
      const inputs = job.kind === "image" ? (job.references ?? []) : [job.source];
      for (const input of inputs) expect(position.get(input), `${job.key} → ${input}`).toBeLessThan(position.get(job.key)!);
    }
    expect(jobs.reduce((sum, job) => sum + jobCost(job), 0)).toBeLessThan(2);
  });
});

describe("the second test", () => {
  const jobs = secondTestJobs(plan);
  const byKey = new Map(jobs.map((job) => [job.key, job]));

  test("makes each input first or takes it from the first test, has unique keys, and stays under $0.75", () => {
    const first = new Set(testRunJobs(plan).map((job) => job.key));
    const position = new Map(jobs.map((job, i) => [job.key, i]));
    for (const job of jobs) {
      for (const input of inputsOf(job)) {
        const madeBefore = position.has(input) ? position.get(input)! < position.get(job.key)! : first.has(input);
        expect(madeBefore, `${job.key} → ${input}`).toBe(true);
      }
    }
    expect(byKey.size).toBe(jobs.length);
    expect(jobs.reduce((sum, job) => sum + jobCost(job), 0)).toBeLessThan(0.75);
  });

  test("its trials have their own keys or are Kling moves the plan dropped since; the rest is the plan's", () => {
    const planned = new Map<string, Job>([...plan.images, ...plan.videos].map((job) => [job.key, job]));
    for (const job of jobs) {
      if (planned.has(job.key)) expect(job).toBe(planned.get(job.key));
      else expect(job.key).toMatch(/^(pairs-p\d+-(draft|final|night)-(seed|grok)|camera-moves-lighthouse-(crash-zoom|dolly-zoom))$/);
    }
  });

  test("tries pairs both ways: one seed at two resolutions, and Grok redrawing what Soul 2 redraws", () => {
    const { prompt, aspectRatio } = image("pairs-p02-draft");
    expect(byKey.get("pairs-p02-draft-seed")).toMatchObject({ model: "soul-2-720p", seed: 161016, prompt, aspectRatio });
    expect(byKey.get("pairs-p02-final-seed")).toMatchObject({ model: "soul-2-1080p", seed: 161016, prompt, aspectRatio });
    // Grok's trials are the plan's own pair jobs under another key: the plan makes what was tested.
    for (const key of ["pairs-p01-final", "pairs-p04-final", "pairs-p26-night"]) {
      expect({ ...byKey.get(`${key}-grok`), key }).toEqual(image(key));
    }
  });

  test("the command line picks it, with the first test's results to compare against", () => {
    expect(selectJobs(plan, { ...NO_FLAGS, "second-test": true })).toEqual({ name: "second-test", jobs, shownWith: secondTestShownWith(plan) });
  });
});

const NO_FLAGS: SelectionFlags = { test: false, "second-test": false, all: false, images: false };

describe("picking jobs on the command line", () => {
  test("a collection comes with the images it starts from in other collections", () => {
    const { name, jobs } = selectJobs(plan, { ...NO_FLAGS, collection: "story" });
    expect(name).toBe("story");
    expect(jobs.filter((job) => job.collection === "story")).toHaveLength(31);
    expect(() => selectJobs(plan, { ...NO_FLAGS, collection: "nope" })).toThrow(/No collection "nope"/);
  });

  test("--only takes named jobs and the images they start from; unknown keys stop it", () => {
    const { name, jobs } = selectJobs(plan, { ...NO_FLAGS, only: "camera-moves-lighthouse-whip-pan, camera-moves-neon-alley-whip-pan" });
    expect(name).toBe("only");
    expect(jobs.map((job) => job.key)).toEqual(["camera-moves-lighthouse", "camera-moves-neon-alley", "camera-moves-lighthouse-whip-pan", "camera-moves-neon-alley-whip-pan"]);
    expect(() => selectJobs(plan, { ...NO_FLAGS, only: "camera-moves-lighthouse-orbit" })).toThrow(/not in it: camera-moves-lighthouse-orbit/);
    expect(() => selectJobs(plan, { ...NO_FLAGS, only: " , " })).toThrow(/none given/);
  });

  test("--all --images is every image of the plan, inputs first; exactly one source is allowed", () => {
    const { name, jobs } = selectJobs(plan, { ...NO_FLAGS, all: true, images: true });
    expect(name).toBe("all-images");
    expect(jobs).toEqual(plan.images);
    expect(() => selectJobs(plan, NO_FLAGS)).toThrow(/Pass one of/);
    expect(() => selectJobs(plan, { ...NO_FLAGS, all: true, collection: "ads" })).toThrow(/Pass one of/);
  });
});
