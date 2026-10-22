"use client";

import { QueryClient, QueryClientProvider, useInfiniteQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { PAGE_SIZE, type FeedPage } from "@/lib/feed";
import type { MediaItem } from "@/lib/manifest";
import { createMediaUrls, GRID_POSTER_SIZES } from "@/lib/media-urls";
import { MediaGrid } from "./MediaGrid";
import { NaivePreview } from "./NaivePreview";

const urls = createMediaUrls(process.env.NEXT_PUBLIC_MEDIA_ORIGIN ?? "");

function hrefFor(item: MediaItem): string {
  return `/m/${item.id}`;
}

function renderPreview(item: MediaItem, active: boolean) {
  const src = urls.preview(item);
  return src === undefined ? null : <NaivePreview src={src} active={active} />;
}

async function fetchPage(cursor: string | null, signal: AbortSignal): Promise<FeedPage> {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (cursor !== null) params.set("cursor", cursor);
  const response = await fetch(`/api/media?${params}`, { signal });
  if (!response.ok) throw new Error(`Loading the feed failed: HTTP ${response.status}`);
  return (await response.json()) as FeedPage;
}

/** The home feed. The first page arrives in the server HTML; later pages come from /api/media. */
export function Feed({ firstPage }: { firstPage: FeedPage }) {
  // A deploy's manifest never changes, so pages never go stale ("static" also keeps the
  // prerender free of Date.now(), which Cache Components rejects).
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: "static" } } }));
  return (
    <QueryClientProvider client={queryClient}>
      <FeedGrid firstPage={firstPage} />
    </QueryClientProvider>
  );
}

function FeedGrid({ firstPage }: { firstPage: FeedPage }) {
  const { data, hasNextPage, isFetchingNextPage, fetchNextPage } = useInfiniteQuery({
    queryKey: ["feed"],
    queryFn: ({ pageParam, signal }) => fetchPage(pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    initialData: { pages: [firstPage], pageParams: [null] },
    // A fixed time instead of the default Date.now(), which would run during the prerender.
    initialDataUpdatedAt: 0,
  });
  const items = useMemo(() => data.pages.flatMap((page) => page.items), [data]);
  const onEndReached = useCallback(() => {
    if (!isFetchingNextPage) void fetchNextPage();
  }, [isFetchingNextPage, fetchNextPage]);

  return (
    <MediaGrid
      items={items}
      total={firstPage.total}
      urls={urls}
      sizes={GRID_POSTER_SIZES}
      getHref={hrefFor}
      label="AI-generated images and videos"
      hasMore={hasNextPage}
      onEndReached={onEndReached}
      renderPreview={renderPreview}
    />
  );
}
