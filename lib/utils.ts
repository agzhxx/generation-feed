/**
 * Joins class names, leaving out the empty ones: what the Genframe Kit's components (components/ui)
 * ask of shadcn's `cn`. It doesn't merge conflicting Tailwind classes as the `cn` package does,
 * which would cost 11 KB of first-load JS; the feed passes none that conflict.
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
