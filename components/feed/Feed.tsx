"use client";

import { keepPreviousData, QueryClient, QueryClientProvider, useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import { MediaGrid, type MediaGridHandle } from "@/components/ui/media-grid/media-grid";
import { VideoPoolProvider } from "@/hooks/use-video-pool";
import { PAGE_SIZE, type FeedPage, type FilterOption } from "@/lib/feed";
import { filtersToParams, type FeedFilters } from "@/lib/filters";
import { likelyLcpIndex } from "@/lib/layout";
import type { MediaItem } from "@/lib/manifest";
import { cardAspect } from "@/lib/masonry-layout";
import { GRID_POSTER_SIZES, GRID_POSTER_SIZES_SAVE_DATA, POSTER_WIDTHS } from "@/lib/media-urls";
import { feedBadges, getMediaUrl, onPreviewStart, toCardItem } from "./feed-cards";
import { Header } from "./Header";
import { LoadError, NoResults, OfflineBanner } from "./states";
import { replaceFilters, useFeedFilters } from "./url-state";
import { useDetail } from "./use-detail";
import { usePreviewPolicy } from "./use-preview-policy";

function hrefFor(item: MediaItem): string {
  return `/m/${item.id}`;
}

/** Cards in the server HTML: the first page (spec 3.4). The likely LCP poster is among them. */
const FIRST_PAGE = 40;

/** One page from /api/media. `filterSearch` is the filters as URL params, e.g. "kind=video". */
async function fetchPage(filterSearch: string, cursor: string | null, signal: AbortSignal): Promise<FeedPage> {
  const params = new URLSearchParams(filterSearch);
  params.set("limit", String(PAGE_SIZE));
  if (cursor !== null) params.set("cursor", cursor);
  const response = await fetch(`/api/media?${params}`, { signal });
  if (!response.ok) throw new Error(`Loading the feed failed: HTTP ${response.status}`);
  return (await response.json()) as FeedPage;
}

/** Filters change in place and the feed starts again from the top (spec 3.3). */
function changeFilters(filters: FeedFilters): void {
  replaceFilters(filters);
  window.scrollTo({ top: 0, behavior: "instant" });
}

const clearFilters = () => changeFilters({});

type PerfOverlay = ComponentType;

export interface FeedProps {
  /** The unfiltered feed's first page, prerendered into the HTML. */
  firstPage: FeedPage;
  models: readonly FilterOption[];
  /** Empty for media without collections: the dropdown then stays out of the header. */
  collections: readonly FilterOption[];
}

/** The home page: header with filters, the grid, its states and the detail overlay. */
export function Feed({ firstPage, models, collections }: FeedProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // A deploy's manifest never changes, so pages never go stale ("static" also keeps the
            // prerender free of Date.now(), which Cache Components rejects).
            staleTime: "static",
            // One quiet retry; after that the Retry button is the user's to press.
            retry: 1,
          },
        },
      }),
  );
  const [Perf, setPerf] = useState<PerfOverlay | null>(null);

  // ?perf=1 loads the perf overlay as its own chunk; otherwise it is never downloaded (spec 4.9).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("perf") !== "1") return;
    let cancelled = false;
    void import("@/components/perf/PerfOverlay").then((module) => {
      if (!cancelled) setPerf(() => module.PerfOverlay);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* One pool per page (spec 4.7): made right after hydration, in a task of its own, so its
          first-click unlock for Safari listens from the start. */}
      <VideoPoolProvider>
        <FeedView firstPage={firstPage} models={models} collections={collections} />
        {Perf !== null && <Perf />}
      </VideoPoolProvider>
    </QueryClientProvider>
  );
}

function FeedView({ firstPage, models, collections }: FeedProps) {
  const filters = useFeedFilters();
  const filterSearch = filtersToParams(filters).toString();
  const {
    data,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    isError,
    isPaused,
    isPlaceholderData,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["feed", filterSearch],
    queryFn: ({ pageParam, signal }) => fetchPage(filterSearch, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    // The prerendered page is the unfiltered feed's; filtered views fetch their own.
    initialData: filterSearch === "" ? { pages: [firstPage], pageParams: [null] } : undefined,
    // A fixed time instead of the default Date.now(), which would run during the prerender.
    initialDataUpdatedAt: 0,
    // The old results stay on screen until the new filters' first page arrives (spec 3.3).
    placeholderData: keepPreviousData,
  });
  const items = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data]);
  // The Kit's cards are named by `alt`.
  const cards = useMemo(() => items.map(toCardItem), [items]);
  // The same choice as the page's preload (app/page.tsx), so both point at one poster.
  const lcpIndex = useMemo(
    () => likelyLcpIndex(items.slice(0, FIRST_PAGE).map((item) => cardAspect(item.width, item.height))),
    [items],
  );
  const total = data?.pages[0]?.total ?? firstPage.total;
  // A failed or offline page waits for Retry (or the connection) instead of being asked for
  // again on every scroll.
  const canLoadMore = hasNextPage && !isPlaceholderData && !isFetchNextPageError && !isPaused;
  const onEndReached = useCallback(() => {
    if (!isFetchingNextPage) void fetchNextPage();
  }, [isFetchingNextPage, fetchNextPage]);

  const policy = usePreviewPolicy();
  const gridRef = useRef<MediaGridHandle>(null);
  const detail = useDetail({
    items,
    total,
    hasMore: canLoadMore,
    loadMore: onEndReached,
    autoPlay: policy.autoplay,
    grid: gridRef,
  });

  const empty = total === 0 && !isPlaceholderData;
  const failedFirstPage = isError && !isFetchNextPageError;

  return (
    <>
      <Header filters={filters} models={models} collections={collections} total={total} onFiltersChange={changeFilters} />
      <main>
        {empty ? (
          <NoResults q={filters.q} onClear={clearFilters} />
        ) : (
          <MediaGrid
            ref={gridRef}
            items={cards}
            total={total}
            getMediaUrl={getMediaUrl}
            widths={POSTER_WIDTHS}
            sizes={policy.saveData ? GRID_POSTER_SIZES_SAVE_DATA : GRID_POSTER_SIZES}
            getHref={hrefFor}
            onOpen={detail.openItem}
            renderOverlay={feedBadges}
            aria-label="AI-generated images and videos"
            hasMore={canLoadMore}
            onEndReached={onEndReached}
            loadingMore={isFetchingNextPage}
            autoplay={policy.autoplay}
            paused={detail.isOpen}
            onPreviewStart={onPreviewStart}
            initialCards={FIRST_PAGE}
            priorityIndex={lcpIndex}
          />
        )}
        {failedFirstPage && <LoadError title="Couldn't load these results." onRetry={() => void refetch()} />}
        {isFetchNextPageError && <LoadError title="Couldn't load more items." onRetry={() => void fetchNextPage()} />}
        <p role="status" className="sr-only">
          {isFetchingNextPage ? "Loading more" : ""}
        </p>
      </main>
      <OfflineBanner />
      {detail.overlay}
    </>
  );
}
