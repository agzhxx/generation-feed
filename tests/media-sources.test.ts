import { describe, expect, test } from "vitest";
import { fingerprint, type JobState } from "@/scripts/generation";
import { buildSources, LEFT_OUT } from "@/scripts/media-sources";
import { buildMediaPlan } from "@/scripts/prompts";
import { sourcesSchema } from "@/scripts/sources";

const plan = buildMediaPlan();
const jobs = [...plan.images, ...plan.videos];

/** A log where every job was made from today's request, a second apart. */
function madeAll(): Map<string, JobState> {
  return new Map(
    jobs.map((job, i): [string, JobState] => [
      job.key,
      {
        attempt: 1,
        fingerprint: fingerprint(job),
        requestId: `r${i}`,
        status: "completed",
        costUsd: 0,
        file: `media-src/real/${job.collection}/${job.key}${job.kind === "image" ? ".png" : ".mp4"}`,
        finishedAt: new Date(Date.UTC(2026, 9, 16, 12) + i * 1000).toISOString(),
      },
    ]),
  );
}

describe("buildSources", () => {
  const sources = buildSources(plan, madeAll(), "media-src/real");

  test("lists every plan job except the ones left out, valid for ingest", () => {
    expect(sources).toHaveLength(jobs.length - Object.keys(LEFT_OUT).length);
    expect(sourcesSchema.safeParse(sources).success).toBe(true);
    expect(sources.some((source) => source.file === "worlds/worlds-487.png")).toBe(false);
  });

  test("carries the optional fields, and a clip's source image file", () => {
    expect(sources.find((source) => source.file === "pairs/pairs-p07-final.png")).toMatchObject({
      collection: "pairs",
      pairId: "p07",
      variant: "final",
      usedBy: ["kit", "queue"],
      model: "Grok Imagine 2.0",
      modelSlug: "grok-imagine-2",
    });
    expect(sources.find((source) => source.file === "camera-moves/camera-moves-red-car-orbit.mp4")).toMatchObject({
      kind: "video",
      cameraMove: "orbit",
      sourceFile: "camera-moves/camera-moves-red-car.png",
      model: "Cinema Studio 4.0",
    });
    expect(sources.find((source) => source.file === "worlds/worlds-009-clip.mp4")).toMatchObject({ sourceFile: "worlds/worlds-009.png" });
    expect(Object.keys(sources.find((source) => source.file === "worlds/worlds-009.png") ?? {})).not.toContain("pairId");
  });

  test("stops on a job without an accepted result, or one made from an older request", () => {
    const missing = madeAll();
    missing.delete("ads-coffee-hero");
    expect(() => buildSources(plan, missing, "media-src/real")).toThrow(/ads-coffee-hero has no accepted result/);
    const outdated = madeAll();
    outdated.set("worlds-001", { ...outdated.get("worlds-001")!, fingerprint: "older" });
    expect(() => buildSources(plan, outdated, "media-src/real")).toThrow(/worlds-001 was made from an older request/);
    const discarded = madeAll();
    discarded.set("story-00-hero", { ...discarded.get("story-00-hero")!, status: "discarded" });
    expect(() => buildSources(plan, discarded, "media-src/real")).toThrow(/story-00-hero/);
  });
});
