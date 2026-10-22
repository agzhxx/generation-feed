import { describe, expect, test } from "vitest";
import { filtersToParams, matchesFilters, parseFilters } from "@/lib/filters";
import { makeItem, makeVideo } from "./fixtures";

const params = (query: string) => new URLSearchParams(query);

describe("parseFilters", () => {
  test("reads valid kind, model and q", () => {
    expect(parseFilters(params("kind=video&model=kling-2-5&q=neon"))).toEqual({
      kind: "video",
      model: "kling-2-5",
      q: "neon",
    });
  });

  test("reads a known collection", () => {
    expect(parseFilters(params("collection=camera-moves&kind=video"))).toEqual({ collection: "camera-moves", kind: "video" });
  });

  test("drops invalid values instead of throwing", () => {
    expect(parseFilters(params("kind=gif&model=Not%20A%20Slug&q=%20%20"))).toEqual({});
    expect(parseFilters(params("collection=landscapes"))).toEqual({});
    expect(parseFilters(params("collection=Worlds"))).toEqual({});
    expect(parseFilters(params(""))).toEqual({});
  });

  test("trims q and caps it at 100 characters", () => {
    expect(parseFilters(params("q=%20neon%20"))).toEqual({ q: "neon" });
    expect(parseFilters(params(`q=${"a".repeat(150)}`)).q).toHaveLength(100);
  });
});

describe("filtersToParams", () => {
  test("writes kind, model, collection and q in a fixed order", () => {
    expect(filtersToParams({ q: "neon", collection: "story", kind: "video", model: "kling-2-5" }).toString()).toBe(
      "kind=video&model=kling-2-5&collection=story&q=neon",
    );
    expect(filtersToParams({}).toString()).toBe("");
  });

  test("round-trips through parseFilters", () => {
    const filters = { kind: "image", model: "soul-2", collection: "pairs", q: "neon city" } as const;
    expect(parseFilters(filtersToParams(filters))).toEqual(filters);
  });
});

describe("matchesFilters", () => {
  const image = makeItem({ prompt: "Neon magenta to teal gradient with stripes" });
  const video = makeVideo({ prompt: "Motion test: life in sand" });

  test("filters by kind and model", () => {
    expect(matchesFilters(image, { kind: "image" })).toBe(true);
    expect(matchesFilters(video, { kind: "image" })).toBe(false);
    expect(matchesFilters(video, { model: "motion-test" })).toBe(true);
    expect(matchesFilters(image, { model: "motion-test" })).toBe(false);
  });

  test("filters by collection; an item without one never matches a collection", () => {
    const story = makeItem({ collection: "story" });
    expect(matchesFilters(story, { collection: "story" })).toBe(true);
    expect(matchesFilters(story, { collection: "ads" })).toBe(false);
    expect(matchesFilters(image, { collection: "story" })).toBe(false);
  });

  test("q needs every word, in any case and order", () => {
    expect(matchesFilters(image, { q: "TEAL neon" })).toBe(true);
    expect(matchesFilters(image, { q: "neon dots" })).toBe(false);
  });
});
