export interface AcquireOptions {
  /** Called once the video's first frame is painted: the moment to swap the poster for it. */
  onFirstFrame?: () => void
  /** Called if the browser refuses to play, e.g. iOS Low Power Mode. */
  onPlayRejected?: (error: unknown) => void
  /** Called if the pool has to take this card's video while the card is still using it. */
  onLost?: () => void
}

export interface VideoPool {
  /** Moves a video into the card's slot and starts playback. */
  acquire(cardId: string, src: string, slot: HTMLElement, options?: AcquireOptions): HTMLVideoElement
  /** Pauses the card's video. It stays warm (keeps its source) until another card needs it. */
  release(cardId: string): void
  /** How many videos the pool owns: 6 on desktop, 2 on phones and low-memory devices by default. */
  readonly size: number
  /** Videos that hold a source, playing or warm. Never more than `size`. */
  liveCount(): number
  /** How many times a video was taken from one card for another. */
  steals(): number
  /** Empties every video and stops listening, e.g. when the page's grid unmounts. */
  dispose(): void
}

interface Entry {
  video: HTMLVideoElement
  /** The card this video belongs to (playing or warm), or null while it is empty. */
  cardId: string | null
  /** True between acquire() and release(). */
  inUse: boolean
  /** When it was last acquired or released. A counter, not a time: higher is more recent. */
  lastUsed: number
  cancelFirstFrame: (() => void) | null
  onPlayRejected: ((error: unknown) => void) | undefined
  onLost: (() => void) | undefined
}

/** Events that can start media in every browser: a click, a key press, the end of a tap. */
const GESTURES = ["click", "keydown", "touchend"] as const

const DESKTOP_POOL_SIZE = 6
const SMALL_POOL_SIZE = 2
const LOW_MEMORY_GB = 4

/** The two facts the pool size depends on. */
export interface Device {
  /** A touch screen: `(pointer: coarse)`. */
  touch: boolean
  /** Approximate RAM in GB (navigator.deviceMemory, Chromium only). */
  deviceMemory?: number
}

function readDevice(): Device {
  return {
    // jsdom, where an app's tests run, has no matchMedia.
    touch: typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches,
    deviceMemory: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
  }
}

/** 2 on touch screens and devices with 4 GB of memory or less, 6 otherwise. */
export function defaultPoolSize({ touch, deviceMemory }: Device = readDevice()): number {
  const lowMemory = deviceMemory !== undefined && deviceMemory <= LOW_MEMORY_GB
  return touch || lowMemory ? SMALL_POOL_SIZE : DESKTOP_POOL_SIZE
}

function createVideo(doc: Document): HTMLVideoElement {
  const video = doc.createElement("video")
  // Muted and inline are what lets browsers play without a click, iOS included.
  video.muted = true
  video.setAttribute("muted", "")
  video.playsInline = true
  video.setAttribute("playsinline", "")
  video.loop = true
  // Nothing downloads until a card actually asks for this video.
  video.preload = "none"
  video.setAttribute("disablepictureinpicture", "")
  video.setAttribute("aria-hidden", "true")
  video.tabIndex = -1
  return video
}

/** Starts playback: a promise in today's browsers, nothing in older ones and in jsdom (an app's tests). */
function startPlaying(video: HTMLVideoElement): Promise<void> | undefined {
  return video.play()
}

/**
 * Calls `callback` once the next frame is painted, and returns a function that cancels it.
 * requestVideoFrameCallback reports the frame as it reaches the screen. Without it: the first
 * decoded frame (loadeddata), or for a video that already has one, playback resuming.
 */
function whenFramePainted(video: HTMLVideoElement, callback: () => void): () => void {
  // Its type says every browser has it; Firefox before 132 doesn't.
  if (typeof (video as Partial<HTMLVideoElement>).requestVideoFrameCallback === "function") {
    const handle = video.requestVideoFrameCallback(() => {
      callback()
    })
    return () => {
      video.cancelVideoFrameCallback(handle)
    }
  }
  const event = video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA ? "playing" : "loadeddata"
  video.addEventListener(event, callback, { once: true })
  return () => {
    video.removeEventListener(event, callback)
  }
}

/**
 * A fixed set of `size` <video> elements (defaultPoolSize() unless told), shared by every card
 * that previews a video. However many cards there are and however fast the pointer moves, at most
 * `size` videos exist, so memory and the hardware's video decoders stay bounded.
 *
 * A card borrows a video with acquire() and hands it back with release(). A released video stays
 * "warm": it keeps its source and stays in the card, so hovering the same card again starts at
 * once. When every video is taken, the least recently used one is stolen: emptied so the browser
 * frees its decoder, then lent to the new card.
 *
 * Call it in the browser: it creates the videos in `doc` at once, and listens to it.
 */
export function createVideoPool(size: number = defaultPoolSize(), doc: Document = document): VideoPool {
  const entries: Entry[] = Array.from({ length: size }, () => ({
    video: createVideo(doc),
    cardId: null,
    inUse: false,
    lastUsed: 0,
    cancelFirstFrame: null,
    onPlayRejected: undefined,
    onLost: undefined,
  }))
  let clock = 0
  let stolen = 0

  function play(entry: Entry): void {
    const owner = entry.cardId
    // A pause() while play() is pending rejects it with an AbortError: expected, not a failure.
    startPlaying(entry.video)?.catch((error: unknown) => {
      const name = typeof error === "object" && error !== null && "name" in error ? error.name : undefined
      if (name === "AbortError") return
      if (entry.cardId === owner && entry.inUse) entry.onPlayRejected?.(error)
    })
  }

  function stopFirstFrameWatch(entry: Entry): void {
    entry.cancelFirstFrame?.()
    entry.cancelFirstFrame = null
  }

  /** Pause, drop the source and load() the empty element: the browser frees its decoder. */
  function empty(entry: Entry): void {
    stopFirstFrameWatch(entry)
    entry.video.pause()
    entry.video.removeAttribute("src")
    entry.video.load()
    entry.cardId = null
    entry.inUse = false
    entry.onPlayRejected = undefined
    entry.onLost = undefined
  }

  /** The least recently used video: an idle one if there is any, else one that is playing. */
  function steal(): Entry {
    const idle = entries.filter((entry) => !entry.inUse)
    const candidates = idle.length > 0 ? idle : entries
    const victim = candidates.reduce((oldest, entry) => (entry.lastUsed < oldest.lastUsed ? entry : oldest))
    const onLost = victim.inUse ? victim.onLost : undefined
    empty(victim)
    stolen++
    onLost?.()
    return victim
  }

  const onVisibilityChange = () => {
    for (const entry of entries) {
      if (doc.hidden) entry.video.pause()
      else if (entry.inUse) play(entry)
    }
  }
  doc.addEventListener("visibilitychange", onVisibilityChange)

  // Safari, in Low Power Mode or with auto-play turned off, refuses play() unless the user just
  // clicked, and remembers it per element: a video that once started inside a click may play on
  // its own later. So on the first click, key press or tap, every video that isn't playing
  // starts and pauses straight away. Sourceless or hidden, nothing shows, and from then on
  // hovers can play. A touch that only scrolled isn't a click to the browser
  // (userActivation.isActive is false), so the pool waits for the next one.
  const unlock = () => {
    const activation: UserActivation | undefined = doc.defaultView?.navigator.userActivation
    if (activation?.isActive === false) return
    stopUnlocking()
    for (const entry of entries) {
      if (entry.inUse) continue
      // Rejects (no source, or the pause right after it): expected. The call is what counts.
      startPlaying(entry.video)?.catch(() => undefined)
      entry.video.pause()
    }
  }
  const stopUnlocking = () => {
    for (const type of GESTURES) doc.removeEventListener(type, unlock, true)
  }
  for (const type of GESTURES) doc.addEventListener(type, unlock, { capture: true, passive: true })

  return {
    size,

    acquire(cardId, src, slot, options = {}) {
      // 1. This card's own video (warm or still playing), 2. a free one, 3. steal one.
      const entry =
        entries.find((candidate) => candidate.cardId === cardId) ??
        entries.find((candidate) => candidate.cardId === null) ??
        steal()
      const { video } = entry

      stopFirstFrameWatch(entry)
      entry.cardId = cardId
      entry.inUse = true
      entry.lastUsed = ++clock
      entry.onPlayRejected = options.onPlayRejected
      entry.onLost = options.onLost

      video.preload = "auto"
      if (video.getAttribute("src") !== src) video.setAttribute("src", src)
      if (video.parentElement !== slot) slot.appendChild(video)

      const { onFirstFrame } = options
      if (onFirstFrame !== undefined) {
        entry.cancelFirstFrame = whenFramePainted(video, () => {
          entry.cancelFirstFrame = null
          onFirstFrame()
        })
      }
      play(entry)
      return video
    },

    release(cardId) {
      const entry = entries.find((candidate) => candidate.cardId === cardId && candidate.inUse)
      if (entry === undefined) return
      stopFirstFrameWatch(entry)
      entry.video.pause()
      entry.inUse = false
      entry.onPlayRejected = undefined
      entry.onLost = undefined
      entry.lastUsed = ++clock
    },

    liveCount: () => entries.filter((entry) => entry.cardId !== null).length,

    steals: () => stolen,

    dispose() {
      doc.removeEventListener("visibilitychange", onVisibilityChange)
      stopUnlocking()
      for (const entry of entries) {
        empty(entry)
        entry.video.remove()
      }
    },
  }
}
