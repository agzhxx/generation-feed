"use client"

import {
  createContext,
  createElement,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react"

const QUERY = "(prefers-reduced-motion: reduce)"

// jsdom, where an app's tests run, has no matchMedia: there, motion isn't reduced.
function hasMatchMedia() {
  return typeof window.matchMedia === "function"
}

function subscribe(onChange: () => void) {
  if (!hasMatchMedia()) return () => {}
  const media = window.matchMedia(QUERY)
  media.addEventListener("change", onChange)
  return () => {
    media.removeEventListener("change", onChange)
  }
}

function getSnapshot() {
  return hasMatchMedia() && window.matchMedia(QUERY).matches
}

// The server can't know the setting. Motion only starts after an interaction, by which time
// the client value has replaced this one.
function getServerSnapshot() {
  return false
}

function subscribeToNothing() {
  return () => {}
}

/** `"user"` follows the operating system's setting; `"always"` and `"never"` override it. */
export type ReducedMotionSetting = "user" | "always" | "never"

const ReducedMotionContext = createContext<ReducedMotionSetting>("user")

export interface ReducedMotionProviderProps {
  /**
   * `"user"` follows the operating system's reduced-motion setting, `"always"` reduces motion
   * for everything inside, and `"never"` keeps full motion there.
   *
   * @defaultValue "user"
   */
  reducedMotion?: ReducedMotionSetting
  children?: ReactNode
}

/**
 * Overrides the operating system's reduced-motion setting for everything inside it: wire it to
 * your app's own "Reduce motion" setting, or force a preview into one mode. The nearest provider
 * wins.
 */
export function ReducedMotionProvider({
  reducedMotion = "user",
  children,
}: ReducedMotionProviderProps) {
  // createElement rather than JSX keeps this a .ts file, like every hook.
  return createElement(ReducedMotionContext, { value: reducedMotion }, children)
}

/**
 * Whether motion should be reduced: the nearest `ReducedMotionProvider`'s setting, or the
 * user's operating-system setting (`prefers-reduced-motion: reduce`) when there's no provider or
 * it says `"user"`. Re-renders when either changes, so a component can switch to its reduced
 * version live.
 */
export function useReducedMotion() {
  const setting = useContext(ReducedMotionContext)
  const followsSystem = setting === "user"
  // Under a provider that overrides the setting there's nothing to listen to: no subscription,
  // and a constant snapshot that the return value ignores.
  const system = useSyncExternalStore(
    followsSystem ? subscribe : subscribeToNothing,
    followsSystem ? getSnapshot : getServerSnapshot,
    getServerSnapshot
  )
  return followsSystem ? system : setting === "always"
}
