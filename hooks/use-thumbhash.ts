import { useMemo } from "react"
import { thumbHashToAverageRGBA, thumbHashToDataURL } from "thumbhash"

// Decoded placeholders by hash. A grid mounts cards again as they scroll back into view, and a
// decode costs about 0.2 ms: kept for the last 200 hashes (about 4 KB each), dropped oldest first.
const MAX_CACHED = 200
const cache = new Map<string, string | undefined>()

function bytes(hash: string) {
  return Uint8Array.from(atob(hash), (char) => char.charCodeAt(0))
}

function decode(hash: string) {
  if (cache.has(hash)) {
    const url = cache.get(hash)
    // Most recently used last, so the oldest goes first.
    cache.delete(hash)
    cache.set(hash, url)
    return url
  }
  let url: string | undefined
  try {
    url = thumbHashToDataURL(bytes(hash))
  } catch {
    url = undefined
  }
  cache.set(hash, url)
  const oldest = cache.keys().next()
  if (cache.size > MAX_CACHED && !oldest.done) cache.delete(oldest.value)
  return url
}

/**
 * A ThumbHash, in base64 as it's usually stored, as a placeholder: a tiny PNG data URL to show
 * while the image loads, which the browser blurs as it scales it up. Undefined without a hash, or
 * for one that doesn't decode. It decodes during rendering, on the server too, and once per hash
 * for the last 200 hashes.
 */
export function useThumbHash(hash: string | undefined): string | undefined {
  return useMemo(() => (hash ? decode(hash) : undefined), [hash])
}

/**
 * A ThumbHash's average color, as CSS (`rgb(39 52 71)`): a few bytes, for placeholders in
 * server-rendered HTML. Undefined for a hash that doesn't decode.
 */
export function thumbHashColor(hash: string): string | undefined {
  try {
    const { r, g, b } = thumbHashToAverageRGBA(bytes(hash))
    return `rgb(${String(Math.round(r * 255))} ${String(Math.round(g * 255))} ${String(Math.round(b * 255))})`
  } catch {
    return undefined
  }
}
