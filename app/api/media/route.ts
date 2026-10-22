import type { NextRequest } from "next/server";
import { getFeedPage, parseLimit } from "@/lib/feed";
import { feedItems } from "@/lib/feed-data";
import { parseFilters } from "@/lib/filters";

/** CDN caches each page for a day, then serves it stale for a week while refreshing. */
const CACHE_CONTROL = "public, s-maxage=86400, stale-while-revalidate=604800";

/** GET /api/media?cursor&limit&kind&model&q → { items, nextCursor, total } (spec 4.4). */
export function GET(request: NextRequest): Response {
  const params = request.nextUrl.searchParams;
  const page = getFeedPage(feedItems, {
    filters: parseFilters(params),
    cursor: params.get("cursor"),
    limit: parseLimit(params.get("limit")),
  });
  return Response.json(page, { headers: { "Cache-Control": CACHE_CONTROL } });
}
