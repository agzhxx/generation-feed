import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DetailKeys } from "@/components/detail/DetailKeys";
import { MediaDetail } from "@/components/detail/MediaDetail";
import { kindLabel, shorten } from "@/lib/detail";
import { findWithNeighbours } from "@/lib/feed";
import { feedItems } from "@/lib/feed-data";
import { BUCKET_ORIGIN, MEDIA_ORIGINS, OG_IMAGE_WIDTH, ogImageUrl } from "@/lib/media-urls";

const TITLE_LENGTH = 60;
const DESCRIPTION_LENGTH = 160;

/**
 * Every /m/<id> must be complete static output (the build checks it). For an id the build
 * didn't see, the request waits for the whole page instead of streaming a shell first, so an
 * unknown id gets a real 404 status rather than a 200 with "not found" streamed in later.
 */
export const ensureStatic = "navigation";

/**
 * Nothing reaches this route through a client-side <Link>: the feed opens its overlay, and the
 * page's own links load full pages. So a navigation here may wait for the page (no shell with
 * placeholders), which turns off the dev-mode check for instant navigations.
 */
export const instant = false;

/** Every item gets a prerendered page (spec 4.4). Unknown ids render on request and get a 404. */
export function generateStaticParams() {
  return feedItems.map((item) => ({ id: item.id }));
}

/** Title, description and the 1200 px JPEG that chat apps and social sites show for a shared link. */
export async function generateMetadata({ params }: PageProps<"/m/[id]">): Promise<Metadata> {
  const found = findWithNeighbours(feedItems, (await params).id);
  if (found === null) return {};
  const { item } = found;
  const title = shorten(item.prompt, TITLE_LENGTH);
  const description = shorten(`${kindLabel(item)}, made with ${item.model}. ${item.prompt}`, DESCRIPTION_LENGTH);
  const width = Math.min(OG_IMAGE_WIDTH, item.width);
  const image = {
    url: ogImageUrl(BUCKET_ORIGIN, item),
    width,
    height: Math.round((width * item.height) / item.width),
    alt: item.prompt,
  };
  return {
    title,
    description,
    openGraph: { title, description, type: "website", siteName: "Generation Feed", images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

/** The full detail page, for a refresh or a shared link. Works without JavaScript. */
export default async function DetailPage({ params }: PageProps<"/m/[id]">) {
  const found = findWithNeighbours(feedItems, (await params).id);
  if (found === null) notFound();
  const { item, index, previous, next } = found;
  const previousHref = previous === null ? null : `/m/${previous.id}`;
  const nextHref = next === null ? null : `/m/${next.id}`;

  return (
    <main className="h-dvh bg-backdrop">
      <h1 className="sr-only">{shorten(item.prompt, TITLE_LENGTH)}</h1>
      <MediaDetail
        item={item}
        mediaOrigins={MEDIA_ORIGINS}
        position={index + 1}
        total={feedItems.length}
        previousHref={previousHref}
        nextHref={nextHref}
      />
      <DetailKeys previousHref={previousHref} nextHref={nextHref} />
    </main>
  );
}
