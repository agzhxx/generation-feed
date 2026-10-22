"use client";

import { useEffect, useState } from "react";
import { onCLS, onINP, onLCP, type Metric } from "web-vitals";
import { firstFrameStats } from "@/lib/preview-metrics";
import { useVideoPool } from "@/hooks/use-video-pool";

const REFRESH_MS = 500;

interface Snapshot {
  live: number;
  size: number;
  steals: number;
  cards: number;
  fps: number;
  firstFrame: ReturnType<typeof firstFrameStats>;
}

/**
 * Live numbers for demos and debugging (spec 4.9): videos in use out of the pool size, steals,
 * cards in the DOM, frames per second, live LCP / CLS / INP, and hover → first frame. Loaded
 * with a dynamic import only when the URL has ?perf=1, so it costs nothing otherwise.
 */
export function PerfOverlay() {
  const pool = useVideoPool();
  const [vitals, setVitals] = useState<Partial<Record<Metric["name"], number>>>({});
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  useEffect(() => {
    const report = (metric: Metric) => setVitals((current) => ({ ...current, [metric.name]: metric.value }));
    onLCP(report, { reportAllChanges: true });
    onCLS(report, { reportAllChanges: true });
    onINP(report, { reportAllChanges: true });
  }, []);

  useEffect(() => {
    let frames = 0;
    let fps = 0;
    let since = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      frames++;
      if (now - since >= 1000) {
        fps = Math.round((frames * 1000) / (now - since));
        frames = 0;
        since = now;
      }
      frame = requestAnimationFrame(tick);
    });
    const interval = window.setInterval(() => {
      setSnapshot({
        live: pool?.liveCount() ?? 0,
        size: pool?.size ?? 0,
        steals: pool?.steals() ?? 0,
        cards: document.querySelectorAll('[role="listitem"]').length,
        fps,
        firstFrame: firstFrameStats(),
      });
    }, REFRESH_MS);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(interval);
    };
  }, [pool]);

  const ms = (value: number | null | undefined) => (value === null || value === undefined ? "–" : `${Math.round(value)} ms`);
  // Every row from the first render, with "–" until there is data, so the panel never
  // changes height. A growing panel would itself count as a layout shift.
  const rows: [string, string][] = [
    ["Videos", snapshot ? `${snapshot.live} / ${snapshot.size} · ${snapshot.steals} steals` : "–"],
    ["Cards in DOM", snapshot ? String(snapshot.cards) : "–"],
    ["FPS", snapshot ? String(snapshot.fps) : "–"],
    ["LCP", vitals.LCP === undefined ? "–" : `${(vitals.LCP / 1000).toFixed(2)} s`],
    ["CLS", vitals.CLS === undefined ? "–" : vitals.CLS.toFixed(3)],
    ["INP", ms(vitals.INP)],
    [
      "Hover → frame",
      snapshot ? `${ms(snapshot.firstFrame.latest)} · p50 ${ms(snapshot.firstFrame.p50)} (${snapshot.firstFrame.count})` : "–",
    ],
  ];

  return (
    <aside
      aria-label="Performance overlay"
      className="pointer-events-none fixed bottom-3 left-3 z-20 rounded-panel bg-surface/90 px-3 py-2 font-mono text-xs text-fg shadow-popover"
    >
      <dl className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 tabular-nums">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-fg-muted">{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}
