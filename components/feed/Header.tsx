"use client";

import { useEffect, useRef, useState } from "react";
import { SearchIcon } from "@/components/icons";
import type { FilterOption } from "@/lib/feed";
import { formatCount } from "@/lib/format";
import type { FeedFilters } from "@/lib/filters";
import { FilterSelects, FiltersSheet, SearchField, TypeChips } from "./FilterBar";

export interface HeaderProps {
  filters: FeedFilters;
  models: readonly FilterOption[];
  /** Empty for media without collections: then there is no collection dropdown. */
  collections: readonly FilterOption[];
  /** Items matching the filters. */
  total: number;
  onFiltersChange: (filters: FeedFilters) => void;
}

/**
 * Sticky header with the filters (design: Header board; layouts in header.css). The visible
 * count moves around between layouts, so screen readers hear it from one hidden live region.
 */
export function Header({ filters, models, collections, total, onFiltersChange }: HeaderProps) {
  const q = filters.q ?? "";
  // Phones: the search field replaces the first row while open, or while a search is active.
  const [searchOpen, setSearchOpen] = useState(false);
  const showSearch = searchOpen || q !== "";
  const inputRef = useRef<HTMLInputElement>(null);
  const countLabel = `${formatCount(total)} ${total === 1 ? "result" : "results"}`;

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus();
  }, [searchOpen]);

  return (
    <header
      data-search={showSearch ? "open" : "closed"}
      className="group/header feed-header sticky top-0 z-10 border-b border-line bg-bg px-4"
    >
      <div className="flex min-w-0 items-center gap-2 [grid-area:name] max-sm:group-data-[search=open]/header:hidden">
        <Logo />
        <h1 className="truncate text-md font-semibold tracking-[-0.01em]">Generation Feed</h1>
      </div>
      <p
        aria-hidden="true"
        className="text-sm whitespace-nowrap text-fg-muted tabular-nums [grid-area:count] max-sm:group-data-[search=open]/header:hidden xl:justify-self-end"
      >
        {countLabel}
      </p>
      <button
        type="button"
        aria-label="Search prompts"
        aria-expanded={showSearch}
        onClick={() => setSearchOpen(true)}
        className="flex size-control items-center justify-center rounded-control text-fg outline-focus transition-colors duration-(--dur-fast) [grid-area:toggle] hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 max-sm:group-data-[search=open]/header:hidden sm:hidden"
      >
        <SearchIcon />
      </button>
      <SearchField
        q={q}
        onSearch={(next) => onFiltersChange({ ...filters, q: next === "" ? undefined : next })}
        countLabel={countLabel}
        inputRef={inputRef}
        onCancel={() => setSearchOpen(false)}
      />
      {/* Negative margins let the row scroll sideways edge to edge on the narrowest phones. */}
      <div className="-mx-4 flex min-w-0 items-center gap-3 overflow-x-auto px-4 [scrollbar-width:none] [grid-area:filters] xl:mx-0 xl:px-0">
        <TypeChips kind={filters.kind} onChange={(kind) => onFiltersChange({ ...filters, kind })} />
        {/* Phones get the pickers in a sheet; wider screens show them in the row. */}
        <FiltersSheet models={models} collections={collections} filters={filters} total={total} onFiltersChange={onFiltersChange} />
        <div className="flex shrink-0 items-center gap-3 max-sm:hidden">
          <FilterSelects models={models} collections={collections} filters={filters} onFiltersChange={onFiltersChange} />
        </div>
      </div>
      <p aria-live="polite" className="sr-only">
        {countLabel}
      </p>
    </header>
  );
}

/** A tiny masonry: three lanes of rounded blocks in the accent color. */
function Logo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="shrink-0 fill-accent">
      <rect x="1" y="1" width="4" height="9" rx="1.25" />
      <rect x="1" y="12" width="4" height="5" rx="1.25" opacity="0.45" />
      <rect x="7" y="1" width="4" height="5" rx="1.25" />
      <rect x="7" y="8" width="4" height="9" rx="1.25" opacity="0.45" />
      <rect x="13" y="1" width="4" height="12" rx="1.25" />
      <rect x="13" y="15" width="4" height="2" rx="1" opacity="0.45" />
    </svg>
  );
}
