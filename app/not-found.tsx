/** Unknown addresses, including /m/<id> for an id that isn't in the feed. */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-lg font-semibold">Nothing here</h1>
      <p className="text-fg-muted">This item isn&apos;t in the feed, or the link is mistyped.</p>
      {/* A plain link: next/link here would add its code (3.3 KB gzip) to every page, because
          this boundary is part of the root layout. A full load of the feed is fine. */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/"
        className="mt-3 inline-flex h-control items-center rounded-control bg-accent px-4 text-sm font-medium text-on-accent outline-focus transition-colors duration-(--dur-fast) hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Back to feed
      </a>
    </main>
  );
}
