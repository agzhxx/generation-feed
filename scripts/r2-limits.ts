/**
 * Cloudflare R2 free tier per month, account-wide
 * (developers.cloudflare.com/r2/pricing, checked 2026-10-15). Storage uses 10^9-byte GB,
 * which is slightly stricter than Cloudflare's own count.
 */
export const R2_FREE_TIER = {
  storageBytes: 10e9,
  classA: 1_000_000,
  classB: 10_000_000,
} as const;

/** Our guard stays at or under this share of every free limit. */
export const GUARD_SHARE = 0.5;

/** The usage check warns at this share and fails at FAIL_SHARE. */
export const WARN_SHARE = 0.5;
export const FAIL_SHARE = 0.8;

/** Operations R2 doesn't bill. */
const FREE_ACTIONS = new Set(["DeleteObject", "DeleteBucket", "AbortMultipartUpload"]);

/**
 * R2 bills reads (Head*, Get*, UsageSummary) as Class B and writes and listings as Class A.
 * An action we don't recognise counts as Class A, the class with the lower limit.
 */
export function operationClass(actionType: string): "A" | "B" | "free" {
  if (FREE_ACTIONS.has(actionType)) return "free";
  if (/^(Head|Get)/.test(actionType) || actionType === "UsageSummary") return "B";
  return "A";
}
