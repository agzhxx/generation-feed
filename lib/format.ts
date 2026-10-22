/**
 * A whole number with thousands separators, like "1,097". Not toLocaleString("en"): the first
 * call loads the browser's locale data, which cost about 40 ms of start-up on a 4× slower CPU
 * (docs/PERF.md). Counts here are always whole and English.
 */
export function formatCount(value: number): string {
  return String(Math.trunc(value)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
