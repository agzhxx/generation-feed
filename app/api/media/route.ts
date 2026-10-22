import type { NextRequest } from "next/server";
import { getFeedPage, parseLimit } from "@/lib/feed";
import { feedItems } from "@/lib/feed-data";
import { parseFilters } from "@/lib/filters";

/** CDN caches each page for a day, then serves it stale for a week while refreshing. */
const CACHE_CONTROL = "public, s-maxage=86400, stale-while-revalidate=604800";

const HEADERS = {
  "Cache-Control": CACHE_CONTROL,
  // Public, read-only data: any site's page may read it, such as the Timeline (project 2). The
  // same answer for every origin, so the CDN's one cached copy fits all.
  "Access-Control-Allow-Origin": "*",
};

/** GET /api/media?cursor&limit&kind&model&collection&q → { items, nextCursor, total } (spec 4.4). */
export function GET(request: NextRequest): Response {
  const params = request.nextUrl.searchParams;
  const page = getFeedPage(feedItems, {
    filters: parseFilters(params),
    cursor: params.get("cursor"),
    limit: parseLimit(params.get("limit")),
  });
  return Response.json(page, { headers: HEADERS });
}
