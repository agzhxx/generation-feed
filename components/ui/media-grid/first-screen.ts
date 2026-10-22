import { laneTotals, placeCards, type LaneStep } from "@/lib/masonry-layout"

/*
 * The grid's first screen, placed by CSS before it knows its width: in server-rendered HTML and
 * React's first render. Each card carries where it goes at every lane step, as custom properties:
 *
 *   --aspect           its height ÷ width
 *   --lN --aN --nN     at step N: its lane, the total aspect of the cards above it, and their count
 *
 * and a container query per step picks the set for the grid's width, then works out the box in
 * cqw (1cqw is 1% of the grid's width) with the same arithmetic as cardBox(). The browser's first
 * paint matches the pixel layout JavaScript switches to later, at any width.
 */

/** The first cards' custom properties, and the spacer's, which gives the grid its height. */
export function firstScreenVariables(aspects: readonly number[], steps: readonly LaneStep[]) {
  const cards = aspects.map((aspect): Record<string, number | string> => ({ "--aspect": aspect }))
  const spacer: Record<string, string> = {}
  steps.forEach(({ lanes, gap }, step) => {
    const placements = placeCards(aspects, lanes)
    placements.forEach((placement, index) => {
      const card = cards[index]
      if (card === undefined) return
      card[`--l${String(step)}`] = placement.lane
      card[`--a${String(step)}`] = placement.above
      card[`--n${String(step)}`] = placement.count
    })
    const laneWidth = `((100cqw - ${String((lanes + 1) * gap)}px) / ${String(lanes)})`
    const laneEnds = laneTotals(placements, aspects, lanes).map(
      (lane) => `${String(lane.aspect)} * ${laneWidth} + ${String(lane.count * gap)}px`
    )
    spacer[`--h${String(step)}`] = `calc(max(${laneEnds.join(", ")}) + ${String(gap)}px)`
  })
  return { cards, spacer }
}

/** The style sheet that places them, for the grid whose `data-media-grid` is `scope`. */
export function firstScreenCss(scope: string, steps: readonly LaneStep[]) {
  const grid = `[data-media-grid="${scope}"]`
  const card = `${grid}>[data-slot=media-grid-item]`
  const spacer = `${grid}>[data-slot=media-grid-spacer]`
  const select = (step: number, { lanes, gap }: LaneStep) =>
    `${card}{--lanes:${String(lanes)};--gap:${String(gap)}px;--lane:var(--l${String(step)});--above:var(--a${String(step)});--count:var(--n${String(step)})}` +
    `${spacer}{height:var(--h${String(step)})}`
  return steps
    .map((step, index) =>
      index === 0
        ? `${grid}{container-type:inline-size}` +
          select(index, step) +
          `${card}{--lane-width:calc((100cqw - (var(--lanes) + 1) * var(--gap)) / var(--lanes));position:absolute;top:0;left:0;` +
          `width:var(--lane-width);height:calc(var(--aspect) * var(--lane-width));` +
          `transform:translate(calc(var(--gap) + var(--lane) * (var(--lane-width) + var(--gap))),calc(var(--above) * var(--lane-width) + (var(--count) + 1) * var(--gap)))}`
        : `@container (width >= ${String(step.minWidth)}px){${select(index, step)}}`
    )
    .join("")
}
