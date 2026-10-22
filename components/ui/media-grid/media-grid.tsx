"use client"

import {
  memo,
  startTransition,
  useEffect,
  useId,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react"
import { flushSync } from "react-dom"

import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import {
  cardAspect,
  cardBox,
  gridHeight,
  gridLayout,
  LANE_STEPS,
  laneSizes,
  laneTotals,
  placeCards,
  type LaneStep,
} from "@/lib/masonry-layout"
import {
  MediaCard,
  type GetMediaUrl,
  type ImageFormat,
  type MediaItem,
  type PosterPriority,
} from "@/components/ui/media-card/media-card"
import { firstScreenCss, firstScreenVariables } from "@/components/ui/media-grid/first-screen"

/** Ask for the next page this many cards before the end. */
const LOAD_AHEAD = 20
/** On touch screens, how long scrolling must pause before the centered video plays. */
const SCROLL_IDLE_MS = 150
/** The height of a loading card, in lane widths: a common portrait shape. */
const SKELETON_ASPECT = 1.25

export interface MediaGridProps<Item extends MediaItem = MediaItem> {
  /** The items loaded so far, in order. Add pages at the end: cards already placed never move. */
  items: readonly Item[]
  /** Your URL builder, which every card asks for its posters and a video's preview. */
  getMediaUrl: GetMediaUrl<Item>
  /**
   * All the items there are, loaded or not: screen readers hear a card's place among them.
   *
   * @defaultValue items.length
   */
  total?: number
  /** Each card's link. Without it, cards are buttons that call `onOpen`. */
  getHref?: (item: Item) => string
  /** Plain clicks on a card call this instead of following its link: open your own detail view. */
  onOpen?: (item: Item, element: HTMLAnchorElement | HTMLButtonElement) => void
  /** What each card shows over its media, such as badges: MediaCard's `children`. */
  renderOverlay?: (item: Item) => ReactNode
  /** Names the list for screen readers. */
  "aria-label"?: string
  /** Names the list by another element's id. */
  "aria-labelledby"?: string
  /**
   * The lanes and gaps by the grid's width, narrowest first.
   *
   * @defaultValue LANE_STEPS: 2, 3, 4 and 5 lanes from 0, 640, 1024 and 1440 px
   */
  lanes?: readonly LaneStep[]
  /**
   * The posters' `<img sizes>`: how wide a lane is on screen.
   *
   * @defaultValue laneSizes(lanes), for a grid as wide as the window
   */
  sizes?: string
  /** MediaCard's `formats`. */
  formats?: readonly ImageFormat[]
  /** MediaCard's `widths`. */
  widths?: readonly number[]
  /** More items can load: the grid calls `onEndReached` as its end comes near. */
  hasMore?: boolean
  /** Load the next page, then add its items to `items`. */
  onEndReached?: () => void
  /** The next page is on its way: every lane ends in a placeholder card. */
  loadingMore?: boolean
  /**
   * Whether previews may start on their own: when the pointer rests on a video, with keyboard
   * focus, and on touch screens, for the video nearest the middle of the screen once scrolling
   * stops. False, or reduced motion, shows play buttons instead. Previews need a VideoPoolProvider.
   *
   * @defaultValue true
   */
  autoplay?: boolean
  /** True while something covers the grid, like a detail view: no preview plays. */
  paused?: boolean
  /** A preview has its first frame on screen: `ms` since it was asked for. */
  onPreviewStart?: (item: Item, ms: number) => void
  /**
   * How many cards CSS places before the grid has measured its width: in server-rendered HTML
   * and the first render. They keep their ThumbHash's average color as their placeholder.
   *
   * @defaultValue 40
   */
  initialCards?: number
  /**
   * How many of those come with their poster: about one large screen. The rest show their
   * placeholder until the grid has measured, so they don't compete with the first screen.
   *
   * @defaultValue 12
   */
  initialPosters?: number
  /**
   * Posters that load at once instead of lazily: the first row at any width.
   *
   * @defaultValue 6
   */
  eagerPosters?: number
  /**
   * The card whose poster loads first, with `fetchpriority="high"`: your page's likely Largest
   * Contentful Paint. Preload the same poster in your page's head.
   *
   * @defaultValue 0
   */
  priorityIndex?: number
  /** The element that scrolls the grid. Without it, the window does. */
  scrollRef?: RefObject<HTMLElement | null>
  className?: string
  ref?: Ref<MediaGridHandle>
}

export interface MediaGridHandle {
  /**
   * Scrolls card `index` into view (to the middle of what's visible if it was off screen, below
   * the scroller's `scroll-padding-top`), renders the cards around it at once, and returns its
   * link or button, to focus.
   */
  reveal(index: number): HTMLElement | null
}

/** The grid's width, and where it starts in the scroller's content. */
interface Geometry {
  width: number
  top: number
}

/** How far the scroller has scrolled, and how tall what it shows is. */
interface Viewport {
  top: number
  height: number
}

/** The touch screen's current pick, and since when it plays. */
interface CenterPick {
  id: string
  since: number
}

function coarsePointer() {
  return typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches
}

interface Scroller {
  /** What fires its scroll events. */
  target: EventTarget
  viewport: () => Viewport
  /** Where the grid starts in its content. */
  start: (grid: HTMLElement) => number
  /** Its `scroll-padding-top`: the part a sticky header covers. */
  padding: () => number
  scrollTo: (top: number) => void
}

/** The window or the element that scrolls the grid, read the same way. */
function scroller(element: HTMLElement | null): Scroller {
  if (element === null) {
    return {
      target: window,
      viewport: () => ({ top: window.scrollY, height: window.innerHeight }),
      start: (grid) => grid.getBoundingClientRect().top + window.scrollY,
      padding: () => parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0,
      scrollTo: (top) => {
        window.scrollTo({ top, behavior: "instant" })
      },
    }
  }
  return {
    target: element,
    viewport: () => ({ top: element.scrollTop, height: element.clientHeight }),
    start: (grid) =>
      grid.getBoundingClientRect().top - element.getBoundingClientRect().top - element.clientTop + element.scrollTop,
    padding: () => parseFloat(getComputedStyle(element).scrollPaddingTop) || 0,
    scrollTo: (top) => {
      element.scrollTo({ top, behavior: "instant" })
    },
  }
}

interface GridCardProps<Item extends MediaItem> {
  item: Item
  getMediaUrl: GetMediaUrl<Item>
  href: string | undefined
  onOpen: MediaGridProps<Item>["onOpen"]
  renderOverlay: MediaGridProps<Item>["renderOverlay"]
  formats: readonly ImageFormat[] | undefined
  widths: readonly number[] | undefined
  sizes: string
  priority: PosterPriority
  showPoster: boolean
  placeholder: "blur" | "color"
  autoplay: boolean
  previewSince: number | null
  paused: boolean
  onPreviewStart: MediaGridProps<Item>["onPreviewStart"]
}

// A card re-renders only when its own props change, not on every scroll frame of the grid.
const GridCard = memo(function GridCard<Item extends MediaItem>({ renderOverlay, ...props }: GridCardProps<Item>) {
  return (
    <MediaCard fill {...props}>
      {renderOverlay?.(props.item)}
    </MediaCard>
  )
}) as <Item extends MediaItem>(props: GridCardProps<Item>) => ReactNode

/**
 * A virtualized masonry grid of media cards. Before it knows its width, in server-rendered HTML
 * and the first render, CSS places its first cards with a style sheet of its own, so the first
 * screen paints before any JavaScript runs. Then it places cards in pixels, the same way, and
 * keeps only the ones within about a screen of what's visible. Videos preview through the shared
 * video pool.
 */
export function MediaGrid<Item extends MediaItem>({
  items,
  getMediaUrl,
  total = items.length,
  getHref,
  onOpen,
  renderOverlay,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledby,
  lanes = LANE_STEPS,
  sizes,
  formats,
  widths,
  hasMore = false,
  onEndReached,
  loadingMore = false,
  autoplay = true,
  paused = false,
  onPreviewStart,
  initialCards = 40,
  initialPosters = 12,
  eagerPosters = 6,
  priorityIndex = 0,
  scrollRef,
  className,
  ref,
}: MediaGridProps<Item>) {
  const scope = useId()
  const gridRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  const [geometry, setGeometry] = useState<Geometry | null>(null)
  const [viewport, setViewport] = useState<Viewport>({ top: 0, height: 0 })
  const [centerPick, setCenterPick] = useState<CenterPick | null>(null)
  const posterSizes = sizes ?? laneSizes(lanes)

  // Measured from the observer's callbacks, after the first paint: the CSS layout already matches
  // the pixel layout, so nothing needs to happen before it.
  useEffect(() => {
    const grid = gridRef.current
    if (grid === null) return
    const element = scrollRef?.current ?? null
    const { target, viewport: readViewport, start } = scroller(element)
    let last: Geometry | null = null
    const measure = () => {
      const next = { width: grid.clientWidth, top: start(grid) }
      setViewport(readViewport())
      // The observer reports the same size again; an ordinary update then would force the
      // pending switch below to finish in one go.
      if (last !== null && last.width === next.width && last.top === next.top) return
      const first = last === null
      last = next
      // The first measure swaps every CSS-placed card for its pixel-placed twin. As a transition,
      // React renders that in short slices instead of one long task.
      if (first) {
        startTransition(() => {
          setGeometry(next)
        })
      } else {
        setGeometry(next)
      }
    }
    const observer = new ResizeObserver(measure)
    observer.observe(grid)
    // A scroll container that changes height shows more or fewer cards.
    if (element !== null) observer.observe(element)

    let frame = 0
    const onScroll = () => {
      if (frame !== 0) return
      frame = requestAnimationFrame(() => {
        frame = 0
        setViewport(readViewport())
      })
    }
    target.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      target.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
    }
  }, [scrollRef])

  const aspects = useMemo(() => items.map((item) => cardAspect(item.width, item.height)), [items])
  const width = geometry?.width ?? 0
  const layout = useMemo(() => (width > 0 ? gridLayout(width, lanes) : null), [width, lanes])
  const laneCount = layout?.lanes ?? 0
  const placements = useMemo(() => (laneCount > 0 ? placeCards(aspects, laneCount) : []), [aspects, laneCount])
  const boxes = useMemo(
    () =>
      layout === null ? [] : placements.map((placement, index) => cardBox(placement, aspects[index] ?? 1, layout)),
    [placements, aspects, layout]
  )
  const firstScreen = useMemo(() => firstScreenVariables(aspects.slice(0, initialCards), lanes), [aspects, initialCards, lanes])

  useImperativeHandle(
    ref,
    () => ({
      reveal(index) {
        const box = boxes[index]
        const grid = gridRef.current
        if (geometry !== null && box !== undefined && grid !== null) {
          const { viewport: readViewport, padding, scrollTo } = scroller(scrollRef?.current ?? null)
          const view = readViewport()
          const top = geometry.top + box.top
          const visibleTop = view.top + padding()
          if (top < visibleTop || top + box.height > view.top + view.height) {
            const room = view.height - padding()
            scrollTo(Math.max(0, top - padding() - (room - box.height) / 2))
          }
          // Render the cards around the new position now, not on the next scroll frame.
          flushSync(() => {
            setViewport(readViewport())
          })
        }
        return (
          grid?.querySelector<HTMLElement>(`[aria-posinset="${String(index + 1)}"] [data-slot="media-card-link"]`) ??
          null
        )
      },
    }),
    [boxes, geometry, scrollRef]
  )

  // Cards within about one screen above and below what's visible.
  const visible: number[] = []
  if (geometry !== null) {
    const from = viewport.top - geometry.top - viewport.height
    const to = viewport.top - geometry.top + 2 * viewport.height
    boxes.forEach((box, index) => {
      if (box.top < to && box.top + box.height > from) visible.push(index)
    })
  }
  const lastVisible = visible.at(-1) ?? -1
  useEffect(() => {
    if (hasMore && lastVisible >= items.length - LOAD_AHEAD) onEndReached?.()
  }, [hasMore, lastVisible, items.length, onEndReached])

  // Touch screens: once scrolling has paused, the video nearest the middle of the screen plays,
  // one at a time. The same pick keeps its start time, so it doesn't restart.
  useEffect(() => {
    if (!autoplay || reduced || geometry === null || !coarsePointer()) return
    const timer = window.setTimeout(() => {
      const screenTop = viewport.top - geometry.top
      const middle = screenTop + viewport.height / 2
      let best: string | null = null
      let bestDistance = Infinity
      boxes.forEach((box, index) => {
        const item = items[index]
        const onScreen = box.top < screenTop + viewport.height && box.top + box.height > screenTop
        if (!onScreen || item?.kind !== "video") return
        const distance = Math.abs(box.top + box.height / 2 - middle)
        if (distance < bestDistance) {
          best = item.id
          bestDistance = distance
        }
      })
      const now = performance.now()
      setCenterPick((current) => (best === null ? null : current?.id === best ? current : { id: best, since: now }))
    }, SCROLL_IDLE_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [autoplay, reduced, geometry, viewport, boxes, items])

  function card(index: number, style: CSSProperties, measured: boolean) {
    const item = items[index]
    if (item === undefined) return null
    return (
      <div
        key={item.id}
        role="listitem"
        aria-posinset={index + 1}
        aria-setsize={total}
        data-slot="media-grid-item"
        className={cn(measured && "absolute top-0 left-0", "focus-within:z-1 hover:z-1")}
        style={style}
      >
        <GridCard
          item={item}
          getMediaUrl={getMediaUrl}
          href={getHref?.(item)}
          onOpen={onOpen}
          renderOverlay={renderOverlay}
          formats={formats}
          widths={widths}
          sizes={posterSizes}
          priority={index === priorityIndex ? "high" : index < eagerPosters ? "eager" : "lazy"}
          showPoster={measured || index < initialPosters}
          placeholder={index < initialCards ? "color" : "blur"}
          autoplay={autoplay}
          previewSince={centerPick?.id === item.id ? centerPick.since : null}
          paused={paused}
          onPreviewStart={onPreviewStart}
        />
      </div>
    )
  }

  const list = {
    ref: gridRef,
    role: "list",
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledby,
    "data-slot": "media-grid",
    "data-media-grid": scope,
  }

  if (layout === null) {
    // Server HTML and the first render: placed by CSS, at any width.
    return (
      <div {...list} data-layout="css" className={cn("relative w-full", className)}>
        <style>{firstScreenCss(scope, lanes)}</style>
        <div aria-hidden="true" data-slot="media-grid-spacer" style={firstScreen.spacer} />
        {firstScreen.cards.map((variables, index) => card(index, variables as CSSProperties, false))}
      </div>
    )
  }

  const totals = laneTotals(placements, aspects, layout.lanes)
  // A placeholder below the last card of every lane, where the next cards will go.
  const skeletons = loadingMore
    ? totals.map((lane, index) => cardBox({ lane: index, above: lane.aspect, count: lane.count }, SKELETON_ASPECT, layout))
    : []
  const height = gridHeight(
    loadingMore ? totals.map((lane) => ({ aspect: lane.aspect + SKELETON_ASPECT, count: lane.count + 1 })) : totals,
    layout
  )

  return (
    <div {...list} data-layout="pixels" className={cn("relative w-full", className)} style={{ height }}>
      {visible.map((index) => {
        const box = boxes[index]
        return box === undefined
          ? null
          : card(index, { width: box.width, height: box.height, transform: `translate(${String(box.left)}px, ${String(box.top)}px)` }, true)
      })}
      {skeletons.map((box, index) => (
        <div
          key={index}
          aria-hidden="true"
          data-slot="media-grid-skeleton"
          className="absolute top-0 left-0 rounded-md bg-muted"
          style={{ width: box.width, height: box.height, transform: `translate(${String(box.left)}px, ${String(box.top)}px)` }}
        />
      ))}
    </div>
  )
}
