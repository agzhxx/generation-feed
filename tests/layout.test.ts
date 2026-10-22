import { describe, expect, test } from "vitest";
import { cardHeight, gridLayout, laneLeft } from "@/lib/layout";

describe("gridLayout", () => {
  test.each([
    [390, 2, 4],
    [639, 2, 4],
    [640, 3, 6],
    [1023, 3, 6],
    [1024, 4, 8],
    [1439, 4, 8],
    [1440, 5, 8],
    [2560, 5, 8],
  ])("a %i px grid has %i lanes and a %i px gap", (width, lanes, gap) => {
    expect(gridLayout(width)).toMatchObject({ lanes, gap });
  });

  test("lanes, gaps and padding fill the width exactly", () => {
    for (const width of [390, 768, 1280, 1440]) {
      const { lanes, gap, laneWidth } = gridLayout(width);
      expect(lanes * laneWidth + (lanes + 1) * gap).toBeCloseTo(width);
    }
  });

  test("matches the design's lane widths", () => {
    expect(gridLayout(1440).laneWidth).toBeCloseTo(278.4);
    expect(gridLayout(390).laneWidth).toBeCloseTo(189);
  });

  test("never goes negative", () => {
    expect(gridLayout(0).laneWidth).toBe(0);
  });
});

describe("cardHeight", () => {
  test("follows the media's aspect ratio", () => {
    expect(cardHeight(200, 1000, 1250)).toBe(250);
    expect(cardHeight(200, 1920, 1080)).toBe(113);
  });

  test("clamps very tall media to 2:1 and very wide media to 1:2", () => {
    expect(cardHeight(200, 100, 1000)).toBe(400);
    expect(cardHeight(200, 2100, 900)).toBe(100);
  });
});

describe("laneLeft", () => {
  test("starts after the padding and steps by lane width plus gap", () => {
    const layout = gridLayout(1440);
    expect(laneLeft(layout, 0)).toBe(8);
    expect(laneLeft(layout, 4)).toBeCloseTo(8 + 4 * (278.4 + 8));
  });
});
