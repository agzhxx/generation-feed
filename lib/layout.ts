/**
 * Which first-page card is the likely Largest Contentful Paint on a phone (spec 4.5): the server
 * preloads its poster, and the grid fetches it first. The masonry math itself is the Genframe
 * Kit's (lib/masonry-layout.ts, installed with `shadcn add`); the reference phone and the header
 * are the feed's.
 */
import { cardBox, gridLayout, placeCards } from "./masonry-layout.ts";

/**
 * The phone the first screen is tuned for: Lighthouse's mobile preset (a Moto G Power),
 * 412 × 823 CSS px. Real phones vary: Safari's toolbars make iPhone screens shorter, and taller
 * Android screens can favor a card further down.
 */
export const REFERENCE_PHONE = { width: 412, height: 823 };
/** The phone header: rows of 52 and 44 px plus its 1 px line (components/feed/header.css). */
export const PHONE_HEADER_HEIGHT = 97;

/**
 * The card most likely to be the Largest Contentful Paint on a phone: the one with the most
 * visible area on the first screen, below the header, with the real lane width and gaps.
 * Cards in a lane are equally wide, so visible height decides. The server preloads its poster
 * with high priority (spec 4.5); larger screens load their whole first row eagerly anyway.
 */
export function likelyLcpIndex(aspects: readonly number[], phone = REFERENCE_PHONE): number {
  const layout = gridLayout(phone.width);
  const screenBottom = phone.height - PHONE_HEADER_HEIGHT;
  let best = 0;
  let bestVisible = 0;
  placeCards(aspects, layout.lanes).forEach((placement, index) => {
    const box = cardBox(placement, aspects[index], layout);
    const visible = Math.min(box.top + box.height, screenBottom) - box.top;
    if (visible > bestVisible) {
      best = index;
      bestVisible = visible;
    }
  });
  return best;
}
