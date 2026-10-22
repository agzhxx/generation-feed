/**
 * Masonry grid math (spec 3.1, 4.6). Pure functions, shared by the grid and its tests; the
 * breakpoints and gaps match the design tokens (app/tokens.css: --container-lanes-*, lane gaps).
 */

/** Lanes and gap by grid width. The grid's padding equals its gap. */
const LANE_STEPS = [
  { minWidth: 1440, lanes: 5, gap: 8 },
  { minWidth: 1024, lanes: 4, gap: 8 },
  { minWidth: 640, lanes: 3, gap: 6 },
  { minWidth: 0, lanes: 2, gap: 4 },
] as const;

/** Card height ÷ width is clamped to 1:2 (wide) … 2:1 (tall); the media is cropped beyond that. */
export const MIN_ASPECT = 0.5;
export const MAX_ASPECT = 2;

export interface GridLayout {
  lanes: number;
  gap: number;
  laneWidth: number;
}

export function gridLayout(gridWidth: number): GridLayout {
  const step = LANE_STEPS.find((candidate) => gridWidth >= candidate.minWidth) ?? LANE_STEPS[3];
  const laneWidth = Math.max(0, (gridWidth - (step.lanes + 1) * step.gap) / step.lanes);
  return { lanes: step.lanes, gap: step.gap, laneWidth };
}

/** Card height in whole pixels, from the media's own size. */
export function cardHeight(laneWidth: number, mediaWidth: number, mediaHeight: number): number {
  const aspect = Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, mediaHeight / mediaWidth));
  return Math.round(laneWidth * aspect);
}

/** Distance from the grid's left edge to a lane's left edge. */
export function laneLeft(layout: GridLayout, lane: number): number {
  return layout.gap + lane * (layout.laneWidth + layout.gap);
}
