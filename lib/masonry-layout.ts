export interface GridLayout {
  lanes: number
  gap: number
  /** Each lane's width in pixels: every lane is as wide as the others. */
  laneWidth: number
}

/** From `minWidth` (the grid's width in CSS pixels) up: this many lanes, with this gap. */
export interface LaneStep {
  minWidth: number
  lanes: number
  /** The space between lanes and between cards, in CSS pixels; the grid's padding is the same. */
  gap: number
}

/** Generation Feed's lanes: 2 on phones, then 3, 4 and 5, with gaps of 4 to 8 px. */
export const LANE_STEPS: readonly LaneStep[] = [
  { minWidth: 0, lanes: 2, gap: 4 },
  { minWidth: 640, lanes: 3, gap: 6 },
  { minWidth: 1024, lanes: 4, gap: 8 },
  { minWidth: 1440, lanes: 5, gap: 8 },
]

/** A card's height ÷ width is clamped to 1:2 (wide) … 2:1 (tall); the media is cropped beyond. */
export const MIN_ASPECT = 0.5
export const MAX_ASPECT = 2

/** The step that applies at `gridWidth`: the last one whose `minWidth` it reaches. */
export function laneStep(gridWidth: number, steps: readonly LaneStep[] = LANE_STEPS): LaneStep {
  let step = steps[0]
  if (step === undefined) throw new Error("A grid needs at least one lane step")
  for (const candidate of steps) if (gridWidth >= candidate.minWidth) step = candidate
  return step
}

/**
 * The lanes, gap and lane width of a grid `gridWidth` pixels wide. With placeCards and cardBox,
 * the masonry math: pure functions, the same on the server and in the browser, so a server can
 * place the first cards before it knows how wide the grid will be.
 */
export function gridLayout(gridWidth: number, steps: readonly LaneStep[] = LANE_STEPS): GridLayout {
  const { lanes, gap } = laneStep(gridWidth, steps)
  const laneWidth = Math.max(0, (gridWidth - (lanes + 1) * gap) / lanes)
  return { lanes, gap, laneWidth }
}

/** A card's height ÷ width, from its media's own size, clamped. */
export function cardAspect(mediaWidth: number, mediaHeight: number): number {
  return Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, mediaHeight / mediaWidth))
}

/** Where a card sits: its lane, the total aspect of the cards above it, and how many there are. */
export interface Placement {
  lane: number
  above: number
  count: number
}

/**
 * Masonry placement from aspect ratios alone: each card goes into the lane whose cards add up to
 * the smallest total aspect (ties go left). Lanes are equally wide, so that is the shortest lane,
 * give or take a few gaps. Unlike pixel heights, aspects don't depend on the grid's width, so a
 * server can place cards without knowing it, and the browser gets exactly the same answer at any
 * width. Adding cards never moves earlier ones.
 */
export function placeCards(aspects: readonly number[], lanes: number): Placement[] {
  const totals = new Array<number>(lanes).fill(0)
  const counts = new Array<number>(lanes).fill(0)
  return aspects.map((aspect) => {
    let lane = 0
    for (let candidate = 1; candidate < lanes; candidate++) {
      if ((totals[candidate] ?? 0) < (totals[lane] ?? 0)) lane = candidate
    }
    const placement = { lane, above: totals[lane] ?? 0, count: counts[lane] ?? 0 }
    totals[lane] = placement.above + aspect
    counts[lane] = placement.count + 1
    return placement
  })
}

export interface Box {
  left: number
  top: number
  width: number
  height: number
}

/** A card's box in pixels, relative to the grid. */
export function cardBox(placement: Placement, aspect: number, layout: GridLayout): Box {
  const { laneWidth, gap } = layout
  return {
    left: gap + placement.lane * (laneWidth + gap),
    top: placement.above * laneWidth + (placement.count + 1) * gap,
    width: laneWidth,
    height: aspect * laneWidth,
  }
}

/** Per lane: the total aspect of its cards and how many there are. */
export interface LaneTotal {
  aspect: number
  count: number
}

export function laneTotals(placements: readonly Placement[], aspects: readonly number[], lanes: number): LaneTotal[] {
  const totals = Array.from({ length: lanes }, () => ({ aspect: 0, count: 0 }))
  placements.forEach((placement, index) => {
    const lane = totals[placement.lane]
    if (lane === undefined) return
    lane.aspect += aspects[index] ?? 0
    lane.count += 1
  })
  return totals
}

/** The grid's height in pixels: its tallest lane plus the bottom padding. */
export function gridHeight(totals: readonly LaneTotal[], layout: GridLayout): number {
  const tallest = Math.max(0, ...totals.map((lane) => lane.aspect * layout.laneWidth + lane.count * layout.gap))
  return tallest + layout.gap
}

/**
 * An `<img sizes>` value for a grid as wide as the window: a lane is 1/2, 1/3… of the viewport,
 * at each step. "(max-width: 639px) 50vw, (max-width: 1023px) 33vw, … 20vw" for LANE_STEPS.
 */
export function laneSizes(steps: readonly LaneStep[] = LANE_STEPS): string {
  return steps
    .map((step, index) => {
      const share = `${String(Math.floor(100 / step.lanes))}vw`
      const next = steps[index + 1]
      return next === undefined ? share : `(max-width: ${String(next.minWidth - 1)}px) ${share}`
    })
    .join(", ")
}
