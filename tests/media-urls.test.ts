import { describe, expect, test } from "vitest";
import type { MediaItem } from "@/lib/manifest";
import {
  mediaUrl,
  ogImageUrl,
  posterSrcSet,
  posterUrl,
  posterWidths,
  previewUrl,
  videoUrl,
} from "@/lib/media-urls";

const ORIGIN = "https://media.example.com";

const image: MediaItem = {
  id: "abcdefgh23",
  kind: "image",
  width: 1000,
  height: 1250,
  thumbhash: "AAAA",
  posterKey: "m/abcdefgh23/v1",
  prompt: "A test",
  model: "Test",
  modelSlug: "test",
  createdAt: "2026-10-01T00:00:00.000Z",
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

describe("posterWidths", () => {
  test("never upscales", () => {
    expect(posterWidths(1000)).toEqual([320, 480, 640, 960]);
    expect(posterWidths(1920)).toEqual([320, 480, 640, 960, 1280, 1920]);
    expect(posterWidths(4000)).toEqual([320, 480, 640, 960, 1280, 1920]);
  });

  test("always has the smallest width, even for tiny sources", () => {
    expect(posterWidths(200)).toEqual([320]);
  });
});

describe("URLs", () => {
  test("joins origin and key with exactly one slash", () => {
    expect(mediaUrl(ORIGIN, "a/b.jpg")).toBe("https://media.example.com/a/b.jpg");
    expect(mediaUrl(`${ORIGIN}/`, "a/b.jpg")).toBe("https://media.example.com/a/b.jpg");
  });

  test("posterUrl picks the smallest width that is big enough", () => {
    expect(posterUrl(ORIGIN, image, 500, "avif")).toBe(`${ORIGIN}/m/abcdefgh23/v1/640.avif`);
    expect(posterUrl(ORIGIN, image, 320, "webp")).toBe(`${ORIGIN}/m/abcdefgh23/v1/320.webp`);
  });

  test("posterUrl falls back to the largest width there is", () => {
    expect(posterUrl(ORIGIN, image, 1800, "avif")).toBe(`${ORIGIN}/m/abcdefgh23/v1/960.avif`);
  });

  test("posterSrcSet lists every available width", () => {
    expect(posterSrcSet(ORIGIN, image, "webp")).toBe(
      [320, 480, 640, 960].map((w) => `${ORIGIN}/m/abcdefgh23/v1/${w}.webp ${w}w`).join(", "),
    );
  });

  test("ogImageUrl points at the link-preview JPEG", () => {
    expect(ogImageUrl(ORIGIN, image)).toBe(`${ORIGIN}/m/abcdefgh23/v1/og.jpg`);
  });

  test("video URLs exist only for videos", () => {
    expect(previewUrl(ORIGIN, video)).toBe(`${ORIGIN}/m/videoid234/v1/preview.mp4`);
    expect(videoUrl(ORIGIN, video)).toBe(`${ORIGIN}/m/videoid234/v1/full.mp4`);
    expect(previewUrl(ORIGIN, image)).toBeUndefined();
    expect(videoUrl(ORIGIN, image)).toBeUndefined();
  });
});
