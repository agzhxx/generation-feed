/**
 * Hover → first painted frame, in milliseconds, for the perf overlay (spec 4.9). The latest
 * 200 samples, kept in memory only.
 */
const MAX_SAMPLES = 200;
const samples: number[] = [];

export function recordFirstFrame(ms: number): void {
  samples.push(ms);
  if (samples.length > MAX_SAMPLES) samples.shift();
}

export function firstFrameStats(): { latest: number | null; p50: number | null; count: number } {
  if (samples.length === 0) return { latest: null, p50: null, count: 0 };
  const sorted = [...samples].sort((a, b) => a - b);
  return { latest: samples[samples.length - 1], p50: sorted[Math.floor(sorted.length / 2)], count: samples.length };
}
