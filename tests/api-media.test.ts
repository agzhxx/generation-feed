import { NextRequest } from "next/server";
import { describe, expect, test } from "vitest";
import { GET } from "@/app/api/media/route";
import type { FeedPage } from "@/lib/feed";

async function get(query: string): Promise<{ response: Response; page: FeedPage }> {
  const response = GET(new NextRequest(`http://localhost/api/media?${query}`));
  return { response, page: (await response.json()) as FeedPage };
}

describe("GET /api/media", () => {
  test("returns a page with CDN cache headers", async () => {
    const { response, page } = await get("limit=5");
    expect(response.headers.get("cache-control")).toBe(
      "public, s-maxage=86400, stale-while-revalidate=604800",
    );
    expect(page.items).toHaveLength(5);
    expect(page.nextCursor).not.toBeNull();
    expect(page.total).toBeGreaterThan(5);
  });

  test("applies filters", async () => {
    const { page } = await get("kind=video&limit=100");
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((item) => item.kind === "video")).toBe(true);
  });

  test("lets any site's page read it, with the same answer for every origin", async () => {
    const { response } = await get("collection=story&kind=video&limit=50");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    // No Vary: Origin: the CDN keeps one copy of each page for everyone.
    expect(response.headers.get("vary")).toBeNull();
  });

  test("ignores invalid params instead of failing", async () => {
    const { response, page } = await get("kind=gif&limit=-3&cursor=%%%");
    expect(response.status).toBe(200);
    expect(page.items.length).toBeGreaterThan(0);
  });
});
