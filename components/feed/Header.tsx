/** Sticky, compact header (design: Header board). Filters and search join it in M4. */
export function Header({ total }: { total: number }) {
  return (
    <header className="sticky top-0 z-10 box-content flex h-header items-center gap-3 border-b border-line bg-bg px-4">
      <div className="flex items-center gap-2">
        <Logo />
        <h1 className="text-md font-semibold tracking-[-0.01em]">Generation Feed</h1>
      </div>
      <p aria-live="polite" className="ml-auto text-sm whitespace-nowrap text-fg-muted tabular-nums">
        {total.toLocaleString("en")} results
      </p>
    </header>
  );
}

/** A tiny masonry: three lanes of rounded blocks in the accent color. */
function Logo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="fill-accent">
      <rect x="1" y="1" width="4" height="9" rx="1.25" />
      <rect x="1" y="12" width="4" height="5" rx="1.25" opacity="0.45" />
      <rect x="7" y="1" width="4" height="5" rx="1.25" />
      <rect x="7" y="8" width="4" height="9" rx="1.25" opacity="0.45" />
      <rect x="13" y="1" width="4" height="12" rx="1.25" />
      <rect x="13" y="15" width="4" height="2" rx="1" opacity="0.45" />
    </svg>
  );
}
