import { describe, expect, test } from "vitest";
import { matchesFilters, parseFilters } from "@/lib/filters";
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

  test("drops invalid values instead of throwing", () => {
    expect(parseFilters(params("kind=gif&model=Not%20A%20Slug&q=%20%20"))).toEqual({});
    expect(parseFilters(params(""))).toEqual({});
  });

  test("trims q and caps it at 100 characters", () => {
    expect(parseFilters(params("q=%20neon%20"))).toEqual({ q: "neon" });
    expect(parseFilters(params(`q=${"a".repeat(150)}`)).q).toHaveLength(100);
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

  test("q needs every word, in any case and order", () => {
    expect(matchesFilters(image, { q: "TEAL neon" })).toBe(true);
    expect(matchesFilters(image, { q: "neon dots" })).toBe(false);
  });
});
