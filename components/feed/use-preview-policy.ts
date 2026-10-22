"use client";

import { useSyncExternalStore } from "react";

type Connection = EventTarget & { saveData?: boolean };

function connection(): Connection | undefined {
  return (navigator as Navigator & { connection?: Connection }).connection;
}

function mediaQuery(query: string) {
  return {
    subscribe(onChange: () => void) {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    read: () => window.matchMedia(query).matches,
  };
}

const reducedMotion = mediaQuery("(prefers-reduced-motion: reduce)");
const saveData = {
  subscribe(onChange: () => void) {
    const current = connection();
    current?.addEventListener("change", onChange);
    return () => current?.removeEventListener("change", onChange);
  },
  read: () => connection()?.saveData === true,
};
/** The server can't know, so it renders the defaults; the client corrects after hydration. */
const serverDefault = () => false;

/**
 * How video previews may behave on this device (spec 3.4). Reduced motion or Save-Data: no
 * autoplay, play buttons instead. (On touch screens, MediaGrid plays the centered card itself.)
 */
export function usePreviewPolicy() {
  const prefersReducedMotion = useSyncExternalStore(reducedMotion.subscribe, reducedMotion.read, serverDefault);
  const isSavingData = useSyncExternalStore(saveData.subscribe, saveData.read, serverDefault);
  return {
    autoplay: !prefersReducedMotion && !isSavingData,
    saveData: isSavingData,
  };
}
