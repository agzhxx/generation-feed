"use client"

import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useEffectEvent,
  useState,
  type ReactNode,
  type RefObject,
} from "react"

import { createVideoPool, type VideoPool } from "@/lib/video-pool"

const VideoPoolContext = createContext<VideoPool | null>(null)

/**
 * A stand-in that makes the real pool, with its <video> elements, the first time it's used, and
 * can make it again after dispose(). The same object on the server, which never calls it, and in
 * the browser: a context value that changed after hydration would re-render everything under it.
 */
function lazyPool(size: number | undefined): VideoPool & { create: () => void } {
  let pool: VideoPool | null = null
  const real = () => (pool ??= createVideoPool(size))
  return {
    get size() {
      return real().size
    },
    acquire: (cardId, src, slot, options) => real().acquire(cardId, src, slot, options),
    release: (cardId) => {
      pool?.release(cardId)
    },
    liveCount: () => pool?.liveCount() ?? 0,
    steals: () => pool?.steals() ?? 0,
    create: () => {
      real()
    },
    dispose: () => {
      pool?.dispose()
      pool = null
    },
  }
}

export interface VideoPoolProviderProps {
  /**
   * How many <video> elements the pool owns: the most previews that can play or stay warm at
   * once. Changing it makes a new pool.
   *
   * @defaultValue 6, or 2 on touch screens and devices with 4 GB of memory or less
   */
  size?: number
  children?: ReactNode
}

/**
 * One video pool for everything inside: media cards borrow its videos for their previews. The
 * pool is made right after the page has hydrated, in a task of its own, or on first use; it's
 * emptied when the provider unmounts.
 */
export function VideoPoolProvider({ size, children }: VideoPoolProviderProps) {
  const [current, setCurrent] = useState(() => ({ size, pool: lazyPool(size) }))
  // A new size, a new pool: the cards release the old one's videos and borrow from the new one.
  if (current.size !== size) setCurrent({ size, pool: lazyPool(size) })
  const { pool } = current

  useEffect(() => {
    // Not in this effect itself: hydration's other effects run first, and on Safari the pool's
    // first-click unlock should listen from the start.
    const timer = window.setTimeout(() => {
      pool.create()
    }, 0)
    return () => {
      window.clearTimeout(timer)
      pool.dispose()
    }
  }, [pool])

  // createElement rather than JSX keeps this a .ts file, like every hook.
  return createElement(VideoPoolContext, { value: pool }, children)
}

/** The nearest VideoPoolProvider's pool, or null outside one: then nothing previews. */
export function useVideoPool(): VideoPool | null {
  return useContext(VideoPoolContext)
}

export interface PooledVideoOptions {
  /** Called if the browser refuses to play, e.g. iOS Low Power Mode: offer a play button. */
  onBlocked?: () => void
  /** Called when the video's first frame is on screen, with the milliseconds since `since`. */
  onFirstFrame?: (ms: number) => void
}

/**
 * Borrows a video from the nearest pool while `since` is a time (a `performance.now()` or event
 * time, from when playback was asked for): the pool moves its <video> into the element `slot`
 * points at and plays `src`, and takes it back when `since` goes back to null. Returns true once
 * that request's first frame is painted, so the slot can stay transparent over the poster until
 * then: the swap never flashes. Without a pool, nothing plays.
 */
export function usePooledVideo(
  slot: RefObject<HTMLElement | null>,
  cardId: string,
  src: string | undefined,
  since: number | null,
  { onBlocked, onFirstFrame }: PooledVideoOptions = {}
): boolean {
  const pool = useVideoPool()
  // Which request has painted a frame. Compared with `since`, it hides the video again as soon
  // as a new request starts, until that one paints too.
  const [paintedFor, setPaintedFor] = useState<number | null>(null)
  const blocked = useEffectEvent(() => onBlocked?.())
  const painted = useEffectEvent((ms: number) => onFirstFrame?.(ms))

  useEffect(() => {
    const element = slot.current
    if (pool === null || element === null || since === null || src === undefined) return
    pool.acquire(cardId, src, element, {
      onFirstFrame: () => {
        setPaintedFor(since)
        painted(performance.now() - since)
      },
      onPlayRejected: () => {
        blocked()
      },
      onLost: () => {
        setPaintedFor(null)
      },
    })
    return () => {
      pool.release(cardId)
    }
  }, [pool, slot, cardId, src, since])

  return since !== null && paintedFor === since
}
