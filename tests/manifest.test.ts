import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { compareItems, manifestSchema, mediaItemSchema, type MediaItem } from "@/lib/manifest";

const image: MediaItem = {
  id: "abcdefgh23",
  kind: "image",
  width: 1024,
  height: 1280,
  thumbhash: "1QcSHQRnh493V4dIh4eXh1h4kJUI",
  posterKey: "m/abcdefgh23/v1",
  prompt: "Test pattern",
  model: "Grid Studio",
  modelSlug: "grid-studio",
  createdAt: "2026-10-01T12:00:00.000Z",
};

const video: MediaItem = {
  ...image,
  id: "videoid234",
  kind: "video",
  posterKey: "m/videoid234/v1",
  previewKey: "m/videoid234/v1/preview.mp4",
  videoKey: "m/videoid234/v1/full.mp4",
  durationSec: 5,
};

describe("mediaItemSchema", () => {
  test("accepts a valid image and video", () => {
    expect(mediaItemSchema.safeParse(image).success).toBe(true);
    expect(mediaItemSchema.safeParse(video).success).toBe(true);
  });

  test("rejects a video without its files", () => {
    expect(mediaItemSchema.safeParse({ ...video, previewKey: undefined }).success).toBe(false);
  });

  test("rejects an image with video fields", () => {
    expect(mediaItemSchema.safeParse({ ...image, durationSec: 5 }).success).toBe(false);
  });

  test("rejects bad ids, slugs and unknown fields", () => {
    expect(mediaItemSchema.safeParse({ ...image, id: "Has/Slash!" }).success).toBe(false);
    expect(mediaItemSchema.safeParse({ ...image, modelSlug: "Grid Studio" }).success).toBe(false);
    expect(mediaItemSchema.safeParse({ ...image, url: "https://x" }).success).toBe(false);
  });
});

describe("manifestSchema", () => {
  test("rejects duplicate ids", () => {
    expect(manifestSchema.safeParse([image, image]).success).toBe(false);
  });
});

describe("compareItems", () => {
  test("sorts newest first, then by id", () => {
    const older = { ...image, id: "aaaaaaaaaa", createdAt: "2026-09-01T00:00:00.000Z" };
    const sameTimeB = { ...image, id: "bbbbbbbbbb" };
    const sameTimeA = { ...image, id: "aaaaaaaaab" };
    expect([older, sameTimeB, sameTimeA].sort(compareItems).map((item) => item.id)).toEqual([
      "aaaaaaaaab",
      "bbbbbbbbbb",
      "aaaaaaaaaa",
    ]);
  });
});

describe("data/manifest.json", () => {
  const items: unknown = JSON.parse(readFileSync("data/manifest.json", "utf8"));

  test("matches the schema", () => {
    const result = manifestSchema.safeParse(items);
    expect(result.success, result.success ? "" : result.error.message).toBe(true);
  });

  test("is in feed order", () => {
    const parsed = manifestSchema.parse(items);
    expect(parsed).toEqual([...parsed].sort(compareItems));
  });
});
