import { describe, expect, test } from "vitest";
import { aspectLabel, formatCreated, kindLabel, shorten } from "@/lib/detail";
import { collectionOptions, findWithNeighbours, modelOptions } from "@/lib/feed";
import { makeItem, makeVideo } from "./fixtures";

describe("aspectLabel", () => {
  test.each([
    [2048, 2048, "1:1"],
    [1638, 2048, "4:5"],
    [1536, 2048, "3:4"],
    [1152, 2048, "9:16"],
    [2048, 1152, "16:9"],
    [2048, 878, "21:9"],
    [720, 1280, "9:16"],
  ])("%i × %i reads %s", (width, height, label) => {
    expect(aspectLabel(width, height)).toBe(label);
  });

  test("falls back to the exact reduced ratio", () => {
    expect(aspectLabel(1000, 700)).toBe("10:7");
  });
});

describe("formatCreated", () => {
  test("prints day, short month and year in UTC", () => {
    expect(formatCreated("2026-10-14T23:30:00.000Z")).toBe("14 Oct 2026");
    expect(formatCreated("2026-01-01T00:00:00.000Z")).toBe("1 Jan 2026");
    expect(formatCreated("2025-12-31T23:59:59.000Z")).toBe("31 Dec 2025");
  });
});

describe("kindLabel", () => {
  test("names videos with their length", () => {
    expect(kindLabel(makeVideo({ durationSec: 5 }))).toBe("Video · 5 s");
    expect(kindLabel(makeItem())).toBe("Image");
  });
});

describe("shorten", () => {
  test("keeps short text as is", () => {
    expect(shorten("Neon city", 60)).toBe("Neon city");
  });

  test("cuts at a word break and drops trailing punctuation", () => {
    const prompt = "Test pattern #001: neon magenta to cobalt gradient with stripes, 1:1";
    expect(shorten(prompt, 60)).toBe("Test pattern #001: neon magenta to cobalt gradient with…");
    expect(shorten("Neon magenta, cobalt", 15)).toBe("Neon magenta…");
  });

  test("cuts inside a word only when there is no break near the end", () => {
    expect(shorten("Supercalifragilistic", 10)).toBe("Supercali…");
  });
});

describe("modelOptions", () => {
  test("lists each model once, by name", () => {
    const items = [
      makeItem({ model: "Grid Studio", modelSlug: "grid-studio" }),
      makeVideo({ model: "Bars Lab", modelSlug: "bars-lab" }),
      makeItem({ id: "bbbbbbbbbb", model: "Grid Studio", modelSlug: "grid-studio" }),
    ];
    expect(modelOptions(items)).toEqual([
      { slug: "bars-lab", name: "Bars Lab" },
      { slug: "grid-studio", name: "Grid Studio" },
    ]);
  });
});

describe("collectionOptions", () => {
  test("lists the collections present, in the media plan's order, with their names", () => {
    const items = [makeItem({ collection: "ads" }), makeVideo({ collection: "worlds" }), makeItem({ id: "bbbbbbbbbb", collection: "ads" })];
    expect(collectionOptions(items)).toEqual([
      { slug: "worlds", name: "Worlds" },
      { slug: "ads", name: "Ads" },
    ]);
  });

  test("is empty when no item has a collection", () => {
    expect(collectionOptions([makeItem(), makeVideo()])).toEqual([]);
  });
});

describe("findWithNeighbours", () => {
  const items = [makeItem({ id: "aaaaaaaaaa" }), makeItem({ id: "bbbbbbbbbb" }), makeItem({ id: "cccccccccc" })];

  test("returns the item with the ones before and after it", () => {
    const found = findWithNeighbours(items, "bbbbbbbbbb");
    expect(found?.index).toBe(1);
    expect(found?.previous?.id).toBe("aaaaaaaaaa");
    expect(found?.next?.id).toBe("cccccccccc");
  });

  test("has no neighbour past either end, and null for an unknown id", () => {
    expect(findWithNeighbours(items, "aaaaaaaaaa")?.previous).toBeNull();
    expect(findWithNeighbours(items, "cccccccccc")?.next).toBeNull();
    expect(findWithNeighbours(items, "zzzzzzzzzz")).toBeNull();
  });
});
