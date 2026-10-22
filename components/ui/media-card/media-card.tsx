"use client"

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type HTMLAttributes,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from "react"

import { cn } from "@/lib/utils"
import { useReducedMotion } from "@/hooks/use-reduced-motion"
import { thumbHashColor, useThumbHash } from "@/hooks/use-thumbhash"
import { usePooledVideo, useVideoPool } from "@/hooks/use-video-pool"

/** One image or video, as MediaCard and MediaGrid show it. Your items can carry more fields. */
export interface MediaItem {
  /** Unique among the items you show: the video pool and React's keys go by it. */
  id: string
  kind: "image" | "video"
  /** The source's width in pixels: with `height`, the card's shape, and the widest poster worth asking for. */
  width: number
  height: number
  /** A ThumbHash of the image, or of the video's poster, in base64: the placeholder until the poster loads. */
  thumbhash?: string
  /** What it shows, for screen readers: the card's name. Leave it empty when a `caption` names the card. */
  alt: string
}

export type ImageFormat = "avif" | "webp" | "jpeg" | "png"

/** What a card asks your URL builder for: a poster at a width and format, or a video's preview. */
export type MediaRequest = { type: "poster"; width: number; format: ImageFormat } | { type: "preview" }

/**
 * Your URL builder: the address of an item's poster at a width and format, or of a video's short,
 * muted preview clip; undefined when there's none.
 */
export type GetMediaUrl<Item extends MediaItem = MediaItem> = (item: Item, request: MediaRequest) => string | undefined

/** "high": the page's largest image, fetched first. "eager": the first screen. "lazy": the rest. */
export type PosterPriority = "high" | "eager" | "lazy"

export interface MediaCardProps<Item extends MediaItem = MediaItem> {
  /** The image or video to show. */
  item: Item
  /** Your URL builder: the card asks it for each poster width in each format, and a video's preview. */
  getMediaUrl: GetMediaUrl<Item>
  /** Where the card links to. Without it, the card is a button that calls `onOpen`. */
  href?: string
  /**
   * Plain clicks call this instead of following `href`: open your own detail view. Ctrl, Cmd and
   * Shift clicks and middle clicks still open the link. Without `href`, every click calls it.
   */
  onOpen?: (item: Item, element: HTMLAnchorElement | HTMLButtonElement) => void
  /**
   * The poster's formats, best first: a `<source>` for each, and the last one also for browsers
   * that take none of them.
   *
   * @defaultValue ["avif", "webp"]
   */
  formats?: readonly ImageFormat[]
  /**
   * The widths your posters come in, in pixels, for the `srcset`. Widths above the item's own are
   * left out, except the smallest.
   *
   * @defaultValue [320, 480, 640, 960, 1280, 1920]
   */
  widths?: readonly number[]
  /**
   * The width the poster is shown at, as `<img sizes>` takes it, so the browser picks a width.
   *
   * @defaultValue "100vw"
   */
  sizes?: string
  /** @defaultValue "lazy" */
  priority?: PosterPriority
  /**
   * What shows until the poster loads. "blur": the ThumbHash as a tiny blurred image, decoded in
   * the browser; a lazy poster fades in over it. "color": its average color, a few bytes, for
   * server-rendered HTML; the poster shows as it loads. "none": shadcn's muted color.
   *
   * @defaultValue "blur"
   */
  placeholder?: "blur" | "color" | "none"
  /**
   * False leaves the poster out for now and shows the placeholder: MediaGrid's server HTML has
   * posters for its first screen only.
   *
   * @defaultValue true
   */
  showPoster?: boolean
  /**
   * The card's width ÷ height; the media is cropped to fit.
   *
   * @defaultValue the item's own
   */
  ratio?: number
  /** Fills its container instead of taking a shape of its own, as MediaGrid's cards do. */
  fill?: boolean
  /**
   * Whether a video's preview may start on its own: when the pointer rests on it, when it has
   * keyboard focus, or with `previewSince`. False shows a play button instead, as reduced motion
   * does; turn it off with Save-Data, for one. Previews need a VideoPoolProvider.
   *
   * @defaultValue true
   */
  autoplay?: boolean
  /**
   * Plays the preview from this moment on (a `performance.now()` time), as a resting pointer
   * does; null stops it. MediaGrid sets it on touch screens, for the video nearest the middle of
   * the screen once scrolling stops.
   */
  previewSince?: number | null
  /** True while something covers the card, like a detail view: its preview doesn't play. */
  paused?: boolean
  /** A video's preview has its first frame on screen: `ms` since it was asked for. */
  onPreviewStart?: (item: Item, ms: number) => void
  /** Text for screen readers after the card's name, such as what pressing it does. */
  description?: string
  /** Something the card started is under way, like adding it somewhere: `aria-busy`. */
  busy?: boolean
  /**
   * What the card shows over its media: badges, a length, a hover hint. The link or button is a
   * Tailwind group named `media-card`, so `group-hover/media-card:` reveals things on hover.
   * Hide from screen readers what `alt` already says.
   */
  children?: ReactNode
  /** Text under the media, inside the link or button, such as a name: part of the card's name. */
  caption?: ReactNode
  /** Classes for the card's outer box. Its other attributes go on its link or button. */
  className?: string
}

type Attributes = Omit<
  HTMLAttributes<HTMLElement>,
  "children" | "className" | "onClick" | "onPointerEnter" | "onPointerLeave" | "onFocus" | "onBlur"
>

/** How long the pointer rests on a video, or keyboard focus stays, before its preview plays. */
const INTENT_MS = 100
/** The width of the plain <img src>, for browsers that take no `srcset`. */
const FALLBACK_WIDTH = 640
const DEFAULT_FORMATS: readonly ImageFormat[] = ["avif", "webp"]
const DEFAULT_WIDTHS: readonly number[] = [320, 480, 640, 960, 1280, 1920]

/** A left click with no modifier keys. */
function isPlainClick(event: MouseEvent) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}

/** The widths worth asking for, narrowest first: up to the source's own, and the smallest always. */
function posterWidths(widths: readonly number[], sourceWidth: number) {
  const sorted = [...widths].sort((a, b) => a - b)
  const fitting = sorted.filter((width) => width <= sourceWidth)
  return fitting.length > 0 ? fitting : sorted.slice(0, 1)
}

/**
 * An image or a video as a card: a link or a button that shows the poster over a ThumbHash
 * placeholder, plays a video's preview from the shared video pool while the pointer rests on it,
 * and offers a play button when previews can't start on their own. It has no layout of its own:
 * MediaGrid places cards, or put one where you like.
 */
export function MediaCard<Item extends MediaItem>({
  item,
  getMediaUrl,
  href,
  onOpen,
  formats = DEFAULT_FORMATS,
  widths = DEFAULT_WIDTHS,
  sizes = "100vw",
  priority = "lazy",
  placeholder = "blur",
  showPoster = true,
  ratio,
  fill = false,
  autoplay = true,
  previewSince = null,
  paused = false,
  onPreviewStart,
  description,
  busy = false,
  children,
  caption,
  className,
  ...attributes
}: MediaCardProps<Item> & Attributes) {
  const reduced = useReducedMotion()
  const pool = useVideoPool()
  const descriptionId = useId()
  const previewSrc = item.kind === "video" ? getMediaUrl(item, { type: "preview" }) : undefined
  const hasPreview = pool !== null && previewSrc !== undefined
  // Decided when the card first appears: a lazy poster fades in over the blur. With the color
  // placeholder, as in server-rendered HTML, it shows as it loads: a fading poster would stay
  // hidden until JavaScript ran.
  const [fades] = useState(() => priority === "lazy" && placeholder === "blur")
  const [loaded, setLoaded] = useState(false)
  // A poster that failed to load: the placeholder stays and a retry button shows.
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [hoverSince, setHoverSince] = useState<number | null>(null)
  const [focusSince, setFocusSince] = useState<number | null>(null)
  const [manualSince, setManualSince] = useState<number | null>(null)
  const [blocked, setBlocked] = useState(false)
  const hoverTimer = useRef<number | undefined>(undefined)
  const focusTimer = useRef<number | undefined>(undefined)

  useEffect(
    () => () => {
      window.clearTimeout(hoverTimer.current)
      window.clearTimeout(focusTimer.current)
    },
    []
  )

  // A press on the play button wins; otherwise previews start on their own, if they may.
  const canAutoplay = autoplay && !reduced && !blocked
  const since = paused ? null : (manualSince ?? (canAutoplay ? (hoverSince ?? focusSince ?? previewSince) : null))
  const showPlayButton = hasPreview && (!autoplay || reduced || blocked)

  const previewSlot = useRef<HTMLSpanElement>(null)
  const previewShowing = usePooledVideo(previewSlot, item.id, hasPreview ? previewSrc : undefined, since, {
    onBlocked: () => {
      setBlocked(true)
    },
    onFirstFrame: (ms) => onPreviewStart?.(item, ms),
  })
  const blur = useThumbHash(placeholder === "blur" ? item.thumbhash : undefined)
  const color = placeholder === "color" && item.thumbhash ? thumbHashColor(item.thumbhash) : undefined

  // A srcset for each format, from the widths that exist; the last format is the <img>'s.
  const available = posterWidths(widths, item.width)
  const sources = formats.flatMap((format) => {
    const entries = available.flatMap((width) => {
      const url = getMediaUrl(item, { type: "poster", width, format })
      return url === undefined ? [] : [`${url} ${String(width)}w`]
    })
    return entries.length > 0 ? [{ format, srcSet: entries.join(", ") }] : []
  })
  const fallback = sources.at(-1)
  const fallbackWidth = available.find((width) => width >= FALLBACK_WIDTH) ?? available.at(-1) ?? FALLBACK_WIDTH
  const shape = fill ? undefined : (ratio ?? item.width / item.height)

  // A request's time is when the pointer or focus arrived, so the time to the first frame includes the wait.
  function startIntent(timer: { current: number | undefined }, start: (since: number) => void) {
    const at = performance.now()
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      start(at)
    }, INTENT_MS)
  }

  const interactive = {
    ...attributes,
    "data-slot": "media-card-link",
    "aria-describedby":
      [attributes["aria-describedby"], description ? descriptionId : undefined].filter(Boolean).join(" ") || undefined,
    "aria-busy": busy || undefined,
    // A button sized by its content would shrink to its caption: it takes the card's width.
    className: cn(
      "group/media-card block w-full rounded-md text-left outline-ring hover:outline-2 hover:outline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2",
      fill && "h-full"
    ),
    onPointerEnter: (event: PointerEvent<HTMLElement>) => {
      // Touch screens have no hover: MediaGrid picks the video nearest the screen's middle.
      if (!hasPreview || event.pointerType === "touch") return
      startIntent(hoverTimer, setHoverSince)
    },
    onPointerLeave: () => {
      window.clearTimeout(hoverTimer.current)
      setHoverSince(null)
    },
    onFocus: (event: FocusEvent<HTMLElement>) => {
      // Keyboard focus plays it like a resting pointer; focus from a click doesn't.
      if (!hasPreview || !event.currentTarget.matches(":focus-visible")) return
      startIntent(focusTimer, setFocusSince)
    },
    onBlur: () => {
      window.clearTimeout(focusTimer.current)
      setFocusSince(null)
    },
  }

  const content = (
    <>
      <span
        data-slot="media-card-media"
        className={cn("relative block overflow-hidden rounded-md bg-muted", fill && "size-full")}
        style={{ aspectRatio: shape, backgroundColor: color }}
      >
        {blur ? (
          <img
            src={blur}
            alt=""
            draggable={false}
            data-slot="media-card-placeholder"
            className="absolute inset-0 size-full object-cover"
          />
        ) : null}
        {showPoster && !failed && fallback ? (
          <picture key={attempt}>
            {sources.slice(0, -1).map((source) => (
              <source key={source.format} type={`image/${source.format}`} srcSet={source.srcSet} sizes={sizes} />
            ))}
            <img
              ref={(img) => {
                // A cached poster can finish loading before React attaches onLoad.
                if (img?.complete && img.naturalWidth > 0) setLoaded(true)
              }}
              src={getMediaUrl(item, { type: "poster", width: fallbackWidth, format: fallback.format })}
              srcSet={fallback.srcSet}
              sizes={sizes}
              alt=""
              loading={priority === "lazy" ? "lazy" : "eager"}
              fetchPriority={priority === "high" ? "high" : "auto"}
              decoding="async"
              draggable={false}
              data-slot="media-card-poster"
              onLoad={() => {
                setLoaded(true)
              }}
              onError={() => {
                setFailed(true)
              }}
              className={cn(
                "absolute inset-0 size-full object-cover",
                fades &&
                  "transition-opacity duration-(--genframe-duration-base) ease-(--genframe-ease-out) in-data-[motion=reduce]:duration-(--genframe-duration-fast)",
                fades && !loaded && "opacity-0"
              )}
            />
          </picture>
        ) : null}
        {hasPreview ? (
          <span
            ref={previewSlot}
            aria-hidden="true"
            data-slot="media-card-preview"
            className={cn(
              "absolute inset-0 transition-opacity duration-(--genframe-duration-fast) ease-(--genframe-ease-out) in-data-[motion=reduce]:transition-none [&>video]:size-full [&>video]:object-cover",
              !previewShowing && "opacity-0"
            )}
          />
        ) : null}
        {item.alt ? <span className="sr-only">{item.alt}</span> : null}
        {children}
      </span>
      {caption}
      {description ? (
        <span id={descriptionId} hidden>
          {description}
        </span>
      ) : null}
    </>
  )

  return (
    <div
      data-slot="media-card"
      data-kind={item.kind}
      data-motion={reduced ? "reduce" : undefined}
      className={cn("relative", fill && "size-full", className)}
    >
      {href !== undefined ? (
        <a
          {...interactive}
          href={href}
          onClick={(event) => {
            if (onOpen === undefined || !isPlainClick(event)) return
            event.preventDefault()
            onOpen(item, event.currentTarget)
          }}
        >
          {content}
        </a>
      ) : (
        <button
          {...interactive}
          type="button"
          onClick={(event) => {
            onOpen?.(item, event.currentTarget)
          }}
        >
          {content}
        </button>
      )}
      {failed || showPlayButton ? (
        // Over the media, beside the link: a button can't sit inside a link or another button.
        <span
          className={cn("pointer-events-none absolute inset-x-0 top-0", fill && "bottom-0")}
          style={{ aspectRatio: shape }}
        >
          {failed ? (
            // 44 px to tap, 28 px to see, in the corner.
            <button
              type="button"
              aria-label="Retry loading image"
              onClick={() => {
                setFailed(false)
                setLoaded(false)
                setAttempt(attempt + 1)
              }}
              className="group/retry pointer-events-auto absolute top-0 right-0 flex size-11 items-center justify-center outline-none"
            >
              <span className="flex size-7 items-center justify-center rounded-full bg-background/70 text-foreground outline-ring group-focus-visible/retry:outline-2 group-focus-visible/retry:outline-offset-2">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M13 8a5 5 0 1 1-1.5-3.55M13 2.75v2.5h-2.5" />
                </svg>
              </span>
            </button>
          ) : null}
          {showPlayButton ? (
            <button
              type="button"
              aria-label={manualSince === null ? "Play preview" : "Pause preview"}
              aria-pressed={manualSince !== null}
              onClick={() => {
                setManualSince(manualSince === null ? performance.now() : null)
              }}
              className="pointer-events-auto absolute top-1/2 left-1/2 flex size-11 -translate-1/2 items-center justify-center rounded-full bg-background/70 text-foreground outline-ring focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
                {manualSince === null ? (
                  <path d="M5.5 3.5 L12.5 8 L5.5 12.5 Z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
                ) : (
                  <path d="M4.5 3.5 h2.5 v9 h-2.5 Z M9 3.5 h2.5 v9 H9 Z" />
                )}
              </svg>
            </button>
          ) : null}
        </span>
      ) : null}
    </div>
  )
}
