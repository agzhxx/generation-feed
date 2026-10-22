"use client";

import { useEffect, useEffectEvent, useId, useRef, useState, type FormEvent, type RefObject } from "react";
import { ChevronDownIcon, CloseIcon, FilterIcon, SearchIcon } from "@/components/icons";
import { isCollection } from "@/lib/collections";
import type { FilterOption } from "@/lib/feed";
import { formatCount } from "@/lib/format";
import { parseFilters, type FeedFilters } from "@/lib/filters";

/** How long typing must pause before the search runs (spec 3.3). */
export const SEARCH_DEBOUNCE_MS = 200;

const KINDS: { value: FeedFilters["kind"]; label: string }[] = [
  { value: undefined, label: "All" },
  { value: "image", label: "Images" },
  { value: "video", label: "Videos" },
];

const CONTROL_FOCUS = "outline-focus focus-visible:outline-2 focus-visible:outline-offset-2";

/** All / Images / Videos. Toggle buttons: the pressed one is the current type. */
export function TypeChips({ kind, onChange }: { kind: FeedFilters["kind"]; onChange: (kind: FeedFilters["kind"]) => void }) {
  return (
    <div role="group" aria-label="Type" className="flex shrink-0 gap-1.5">
      {KINDS.map((option) => {
        const pressed = option.value === kind;
        return (
          <button
            key={option.label}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(option.value)}
            className={`h-control rounded-pill border px-3.5 text-sm font-medium whitespace-nowrap transition-colors duration-(--dur-fast) ${CONTROL_FOCUS} ${
              pressed
                ? "border-transparent bg-accent text-on-accent"
                : "border-line text-fg-muted hover:bg-surface-raised hover:text-fg"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** A native select, styled: the browser's own menu works with every input method. */
export function FilterSelect({
  label,
  allLabel,
  options,
  value,
  onChange,
  wide = false,
}: {
  /** The select's name for screen readers, e.g. "Model". */
  label: string;
  /** The first entry, which clears this filter, e.g. "All models". */
  allLabel: string;
  options: readonly FilterOption[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  /** Fills its container, as in the phone's filter sheet. */
  wide?: boolean;
}) {
  return (
    <label className={`relative flex shrink-0 items-center ${wide ? "w-full" : ""}`}>
      <span className="sr-only">{label}</span>
      <select
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value === "" ? undefined : event.target.value)}
        className={`h-control appearance-none rounded-control border border-line-strong bg-surface-raised pr-8 pl-3 text-sm transition-colors duration-(--dur-fast) hover:bg-line ${wide ? "w-full text-md" : ""} ${CONTROL_FOCUS}`}
      >
        <option value="">{allLabel}</option>
        {options.map((option) => (
          <option key={option.slug} value={option.slug}>
            {option.name}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2.5 text-fg-muted">
        <ChevronDownIcon />
      </span>
    </label>
  );
}

/** The model and collection pickers, side by side: inline on tablets and desktops. */
export function FilterSelects({
  models,
  collections,
  filters,
  onFiltersChange,
  wide = false,
}: {
  models: readonly FilterOption[];
  /** Empty for media without collections: then there is no collection picker. */
  collections: readonly FilterOption[];
  filters: FeedFilters;
  onFiltersChange: (filters: FeedFilters) => void;
  wide?: boolean;
}) {
  return (
    <>
      <FilterSelect label="Model" allLabel="All models" options={models} value={filters.model} wide={wide} onChange={(model) => onFiltersChange({ ...filters, model })} />
      {collections.length > 0 && (
        <FilterSelect
          label="Collection"
          allLabel="All collections"
          options={collections}
          value={filters.collection}
          wide={wide}
          onChange={(value) => onFiltersChange({ ...filters, collection: value !== undefined && isCollection(value) ? value : undefined })}
        />
      )}
    </>
  );
}

/**
 * Phones: the model and collection pickers live in a sheet behind a Filters button, so all
 * the controls show without scrolling the row sideways. A native modal <dialog>: the browser
 * traps focus in it, Esc closes it, and focus goes back to the button. Choices apply at once,
 * so the results update behind the sheet.
 */
export function FiltersSheet({
  models,
  collections,
  filters,
  total,
  onFiltersChange,
}: {
  models: readonly FilterOption[];
  collections: readonly FilterOption[];
  filters: FeedFilters;
  /** Items matching the filters. */
  total: number;
  onFiltersChange: (filters: FeedFilters) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const active = Number(filters.model !== undefined) + Number(filters.collection !== undefined);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={`flex h-control shrink-0 items-center gap-1.5 rounded-pill border border-line px-3 text-sm font-medium text-fg transition-colors duration-(--dur-fast) hover:bg-surface-raised sm:hidden ${CONTROL_FOCUS}`}
      >
        <FilterIcon />
        Filters
        {active > 0 && (
          <span className="flex size-5 items-center justify-center rounded-pill bg-accent text-xs text-on-accent tabular-nums">
            {active}
            <span className="sr-only"> on</span>
          </span>
        )}
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        // Esc and close() both end here, so the button's state always matches the sheet. Focus
        // goes back to the button explicitly: Safari doesn't focus a button on click, so the
        // dialog alone would hand it back to the page.
        onClose={() => {
          setOpen(false);
          buttonRef.current?.focus();
        }}
        // A tap on the backdrop lands on the dialog itself; taps on the sheet land inside it.
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}
        className="filter-sheet mx-0 mt-auto mb-0 w-full max-w-none rounded-t-panel border-t border-line bg-surface p-0 text-fg backdrop:bg-scrim"
      >
        {open && (
          <div className="flex flex-col gap-3 px-4 pt-4 pb-[max(16px,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between">
              <h2 id={titleId} className="text-md font-semibold">
                Filters
              </h2>
              {active > 0 && (
                <button
                  type="button"
                  onClick={() => onFiltersChange({ ...filters, model: undefined, collection: undefined })}
                  className={`h-control rounded-control px-2 text-sm font-medium text-fg-muted transition-colors duration-(--dur-fast) hover:bg-surface-raised hover:text-fg ${CONTROL_FOCUS}`}
                >
                  Clear
                </button>
              )}
            </div>
            <FilterSelects models={models} collections={collections} filters={filters} onFiltersChange={onFiltersChange} wide />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className={`mt-1 h-11 rounded-control bg-accent text-md font-semibold text-on-accent ${CONTROL_FOCUS}`}
            >
              Show {formatCount(total)} {total === 1 ? "result" : "results"}
            </button>
          </div>
        )}
      </dialog>
    </>
  );
}

/** What a search box's text becomes in the URL: trimmed, at most 100 characters. */
function normalize(text: string): string {
  return parseFilters(new URLSearchParams({ q: text })).q ?? "";
}

/**
 * Search in prompts, debounced (spec 3.3). The box keeps exactly what was typed while the URL
 * gets the trimmed query; when the query changes from outside (Clear filters, the URL on load),
 * the box follows.
 */
export function SearchField({
  q,
  onSearch,
  countLabel,
  inputRef,
  onCancel,
}: {
  q: string;
  onSearch: (q: string) => void;
  /** Phones show the result count inside the open field. */
  countLabel: string;
  inputRef: RefObject<HTMLInputElement | null>;
  /** Phones: closes the search row again. */
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(q);
  const [seenQ, setSeenQ] = useState(q);
  if (q !== seenQ) {
    setSeenQ(q);
    if (normalize(draft) !== q) setDraft(q);
  }

  // Reads the latest onSearch without restarting the wait when the parent re-renders.
  const search = useEffectEvent((text: string) => onSearch(text));
  useEffect(() => {
    const next = normalize(draft);
    if (next === q) return;
    const timer = window.setTimeout(() => search(next), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draft, q]);

  function clear() {
    setDraft("");
    onSearch("");
  }

  function submit(event: FormEvent) {
    // Enter searches at once.
    event.preventDefault();
    onSearch(normalize(draft));
  }

  return (
    <form role="search" onSubmit={submit} className="flex items-center gap-2 [grid-area:search] max-sm:group-data-[search=closed]/header:hidden sm:justify-self-end xl:justify-self-start">
      <label className="flex h-control min-w-0 flex-1 items-center gap-2 rounded-control border border-line-strong bg-surface-raised pr-1 pl-2.5 outline-focus focus-within:outline-2 focus-within:outline-offset-2 sm:w-70 sm:flex-none">
        <span className="shrink-0 text-fg-muted">
          <SearchIcon />
        </span>
        <input
          ref={inputRef}
          type="search"
          // Its own name: the label around it also holds the clear button and the count.
          aria-label="Search prompts"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Search prompts"
          enterKeyHint="search"
          autoComplete="off"
          // 16 px on phones, or iOS zooms the page when the field gets focus.
          className="h-full min-w-0 flex-1 bg-transparent text-md outline-none placeholder:text-fg-subtle sm:text-sm [&::-webkit-search-cancel-button]:appearance-none"
        />
        <span aria-hidden="true" className="shrink-0 text-xs text-fg-muted tabular-nums sm:hidden">
          {countLabel}
        </span>
        {draft !== "" && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              clear();
              inputRef.current?.focus();
            }}
            className={`flex size-7 shrink-0 items-center justify-center rounded-badge text-fg-muted transition-colors duration-(--dur-fast) hover:bg-line hover:text-fg ${CONTROL_FOCUS}`}
          >
            <CloseIcon />
          </button>
        )}
      </label>
      <button
        type="button"
        onClick={() => {
          clear();
          onCancel();
        }}
        className={`h-control shrink-0 rounded-control px-2 text-sm font-medium text-fg transition-colors duration-(--dur-fast) hover:bg-surface-raised sm:hidden ${CONTROL_FOCUS}`}
      >
        Cancel
      </button>
    </form>
  );
}
