import { preload } from "react-dom";
import { Feed } from "@/components/feed/Feed";
import { collectionOptions, getFeedPage, modelOptions } from "@/lib/feed";
import { feedItems } from "@/lib/feed-data";
import { likelyLcpIndex } from "@/lib/layout";
import { cardAspect } from "@/lib/masonry-layout";
import { GRID_POSTER_SIZES, MEDIA_ORIGINS, posterSrcSet, posterUrl } from "@/lib/media-urls";

/**
 * Static: the unfiltered first page of the feed is part of the prerendered HTML (spec 4.4).
 * A filtered address (/?kind=video) loads the same HTML; the client applies its filters.
 */
export default function Home() {
  const firstPage = getFeedPage(feedItems);
  const lcpItem = firstPage.items[likelyLcpIndex(firstPage.items.map((item) => cardAspect(item.width, item.height)))];
  if (lcpItem !== undefined) {
    // The likely LCP poster starts downloading with the HTML, before any JavaScript (spec 4.5).
    preload(posterUrl(MEDIA_ORIGINS.posters, lcpItem, 640, "avif"), {
      as: "image",
      type: "image/avif",
      imageSrcSet: posterSrcSet(MEDIA_ORIGINS.posters, lcpItem, "avif"),
      imageSizes: GRID_POSTER_SIZES,
      fetchPriority: "high",
    });
  }

  return <Feed firstPage={firstPage} models={modelOptions(feedItems)} collections={collectionOptions(feedItems)} />;
}
