import { preload } from "react-dom";
import { Feed } from "@/components/feed/Feed";
import { Header } from "@/components/feed/Header";
import { getFeedPage } from "@/lib/feed";
import { feedItems } from "@/lib/feed-data";
import { GRID_POSTER_SIZES, posterSrcSet, posterUrl } from "@/lib/media-urls";

const MEDIA_ORIGIN = process.env.NEXT_PUBLIC_MEDIA_ORIGIN ?? "";

/** Static: the first page of the feed is part of the prerendered HTML (spec 4.4). */
export default function Home() {
  const firstPage = getFeedPage(feedItems);
  const lcpItem = firstPage.items[0];
  if (lcpItem !== undefined) {
    // The first poster starts downloading with the HTML, before any JavaScript runs (spec 4.5).
    preload(posterUrl(MEDIA_ORIGIN, lcpItem, 640, "avif"), {
      as: "image",
      type: "image/avif",
      imageSrcSet: posterSrcSet(MEDIA_ORIGIN, lcpItem, "avif"),
      imageSizes: GRID_POSTER_SIZES,
      fetchPriority: "high",
    });
  }

  return (
    <>
      <Header total={firstPage.total} />
      <main>
        <Feed firstPage={firstPage} />
      </main>
    </>
  );
}
