import type { MediaItem } from "@/lib/manifest";

/** A valid item; override any field. Ids must stay 10 base32hex characters (0-9, a-v). */
export function makeItem(overrides: Partial<MediaItem> = {}): MediaItem {
  return {
    id: "aaaaaaaaaa",
    kind: "image",
    width: 1024,
    height: 1280,
    thumbhash: "1QcSHQRnh493V4dIh4eXh1h4kJUI",
    posterKey: "m/aaaaaaaaaa/v1",
    prompt: "Test pattern",
    model: "Grid Studio",
    modelSlug: "grid-studio",
    createdAt: "2026-10-01T12:00:00.000Z",
    ...overrides,
  };
}

export function makeVideo(overrides: Partial<MediaItem> = {}): MediaItem {
  const id = overrides.id ?? "vvvvvvvvvv";
  return makeItem({
    id,
    kind: "video",
    width: 1280,
    height: 720,
    posterKey: `m/${id}/v1`,
    previewKey: `m/${id}/v1/preview.mp4`,
    videoKey: `m/${id}/v1/full.mp4`,
    durationSec: 5,
    model: "Motion Test",
    modelSlug: "motion-test",
    ...overrides,
  });
}
