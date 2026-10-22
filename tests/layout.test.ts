import { describe, expect, test } from "vitest";
import { likelyLcpIndex } from "@/lib/layout";
import { cardAspect, cardBox, gridHeight, gridLayout, laneTotals, placeCards } from "@/lib/masonry-layout";

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

describe("cardAspect", () => {
  test("follows the media's aspect ratio", () => {
    expect(cardAspect(1000, 1250)).toBe(1.25);
    expect(cardAspect(1920, 1080)).toBe(0.5625);
  });

  test("clamps very tall media to 2:1 and very wide media to 1:2", () => {
    expect(cardAspect(100, 1000)).toBe(2);
    expect(cardAspect(2100, 900)).toBe(0.5);
  });
});

describe("placeCards", () => {
  test("fills lanes left to right, then always picks the lane with the smallest total aspect", () => {
    const placements = placeCards([1, 2, 0.5, 1, 1], 3);
    expect(placements.map((placement) => placement.lane)).toEqual([0, 1, 2, 2, 0]);
    expect(placements[3]).toEqual({ lane: 2, above: 0.5, count: 1 });
    expect(placements[4]).toEqual({ lane: 0, above: 1, count: 1 });
  });

  test("adding cards never moves the earlier ones", () => {
    const aspects = [1.25, 0.5625, 2, 1, 0.75, 1.333, 0.5, 1.777, 1, 1.25];
    const all = placeCards(aspects, 4);
    expect(placeCards(aspects.slice(0, 6), 4)).toEqual(all.slice(0, 6));
  });
});

describe("likelyLcpIndex", () => {
  // The reference phone is 412 px wide: 2 lanes of 200 px with 4 px gaps, and 726 px of screen
  // below the 97 px header.
  test("picks the card with the most visible area in a phone's first screen", () => {
    // Lane 0: index 0 (200 px tall), index 2 (150). Lane 1: index 1 (250), index 3 (355, all on screen).
    expect(likelyLcpIndex([1, 1.25, 0.75, 1.777])).toBe(3);
  });

  test("only counts the part of a card that is on screen", () => {
    // 400 px of screen: index 3 starts at 258 px, so only 142 px of it shows; index 1 shows 250.
    expect(likelyLcpIndex([1, 1.25, 0.75, 2], { width: 412, height: 97 + 400 })).toBe(1);
  });

  test("counts the header: a taller header can move the pick to a card higher up", () => {
    // The real first page: #001, #002, #003, a video, #004 (9:16, starting at 462 px).
    const firstPage = [1, 1.25, 1.333, 1, 1.777];
    // 726 px of screen: #004 shows 264 px, #003 shows all of its 267 px.
    expect(likelyLcpIndex(firstPage)).toBe(2);
    // 40 px more screen (the M3 header was 57 px tall): 304 px of #004 shows, so it wins.
    expect(likelyLcpIndex(firstPage, { width: 412, height: 823 + 40 })).toBe(4);
  });
});

describe("cardBox and gridHeight", () => {
  const aspects = [1, 2, 0.5, 1];
  const layout = gridLayout(400); // 2 lanes, 4 px gap, lane width 194
  const placements = placeCards(aspects, layout.lanes);

  test("a card sits below the cards above it in its lane, with a gap between each", () => {
    // Lane 0: aspects 1, then 0.5 (index 2), then 1 (index 3).
    expect(cardBox(placements[0], 1, layout)).toEqual({ left: 4, top: 4, width: 194, height: 194 });
    expect(cardBox(placements[1], 2, layout)).toEqual({ left: 202, top: 4, width: 194, height: 388 });
    expect(cardBox(placements[2], 0.5, layout)).toEqual({ left: 4, top: 202, width: 194, height: 97 });
    expect(cardBox(placements[3], 1, layout)).toEqual({ left: 4, top: 303, width: 194, height: 194 });
  });

  test("the grid is as tall as its tallest lane plus the padding", () => {
    // Lane 0 ends at 303 + 194 = 497; lane 1 at 4 + 388 = 392.
    expect(gridHeight(laneTotals(placements, aspects, layout.lanes), layout)).toBe(497 + 4);
  });
});
