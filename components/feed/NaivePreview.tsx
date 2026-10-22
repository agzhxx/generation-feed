"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The M2 baseline, slow on purpose: every mounted video card owns its own <video>, which
 * fetches metadata as soon as it mounts and keeps a decoder per card. M3 replaces it with a
 * small shared pool and measures the difference (docs/PERF.md).
 */
export function NaivePreview({ src, active }: { src: string; active: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (video === null) return;
    if (active) {
      // A rejected play() (Low Power Mode, for example) leaves the poster showing.
      video.play().catch(() => undefined);
    } else {
      video.pause();
    }
  }, [active]);

  return (
    <video
      ref={videoRef}
      src={src}
      muted
      loop
      playsInline
      preload="metadata"
      disablePictureInPicture
      aria-hidden="true"
      tabIndex={-1}
      onPlaying={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      className={`absolute inset-0 size-full object-cover transition-opacity duration-(--dur-fast) ease-out ${
        active && playing ? "opacity-100" : "opacity-0"
      }`}
    />
  );
}
