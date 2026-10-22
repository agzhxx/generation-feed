import { act, render } from "@testing-library/react";
import { createRef, type Ref } from "react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { feedBadges, getMediaUrl, toCardItem } from "@/components/feed/feed-cards";
import { MediaGrid, type MediaGridHandle } from "@/components/ui/media-grid/media-grid";
import type { MediaItem } from "@/lib/manifest";
import { GRID_POSTER_SIZES, POSTER_WIDTHS } from "@/lib/media-urls";
import { installDomStubs, removeDomStubs } from "./dom-stubs";
import { makeItem } from "./fixtures";

// The feed's grid: the Genframe Kit's MediaGrid (installed with `shadcn add`, and tested in the
// Kit) with the feed's props, as Feed renders it.

/** Ids are 10 base32hex characters: "000000000a", "000000000b" … */
function makeItems(count: number): MediaItem[] {
  return Array.from({ length: count }, (_, index) => makeItem({ id: index.toString(32).padStart(10, "0") }));
}

function grid(props: { items?: MediaItem[]; hasMore?: boolean; loadingMore?: boolean; ref?: Ref<MediaGridHandle> }) {
  return (
    <MediaGrid
      ref={props.ref}
      items={(props.items ?? makeItems(40)).map(toCardItem)}
      getMediaUrl={getMediaUrl}
      widths={POSTER_WIDTHS}
      sizes={GRID_POSTER_SIZES}
      getHref={(item) => `/m/${item.id}`}
      renderOverlay={feedBadges}
      aria-label="Feed"
      hasMore={props.hasMore}
      onEndReached={() => {}}
      loadingMore={props.loadingMore}
    />
  );
}

beforeEach(() => installDomStubs({ width: 1024 }));
afterEach(removeDomStubs);

describe("MediaGrid in the feed", () => {
  test("while the next page loads, every lane ends in a placeholder card", () => {
    const { container, rerender } = render(grid({}));
    const list = () => container.querySelector<HTMLElement>('[role="list"]')!;
    expect(container.querySelectorAll('[data-slot="media-grid-skeleton"]')).toHaveLength(0);
    const heightBefore = parseFloat(list().style.height);

    rerender(grid({ hasMore: true, loadingMore: true }));
    // 1,024 px wide: four lanes.
    const skeletons = container.querySelectorAll('[data-slot="media-grid-skeleton"]');
    expect(skeletons).toHaveLength(4);
    expect(skeletons[0].getAttribute("aria-hidden")).toBe("true");
    expect(parseFloat(list().style.height)).toBeGreaterThan(heightBefore);
  });

  test("first-page cards keep the average-color placeholder; cards further down get the blur", () => {
    const ref = createRef<MediaGridHandle>();
    const { container } = render(grid({ ref, items: makeItems(60) }));
    const media = (position: number) =>
      container.querySelector<HTMLElement>(`[aria-posinset="${position}"] [data-slot="media-card-media"]`);
    const placeholder = (position: number) =>
      container.querySelector(`[aria-posinset="${position}"] [data-slot="media-card-placeholder"]`);
    expect(media(1)?.style.backgroundColor).toMatch(/^rgb\(/);
    expect(placeholder(1)).toBeNull();

    act(() => {
      ref.current?.reveal(55);
    });
    expect(placeholder(56)?.getAttribute("src")).toMatch(/^data:image\/png;base64,/);
  });

  test("reveal() scrolls an unmounted card into view and returns its link", () => {
    const ref = createRef<MediaGridHandle>();
    const { container } = render(grid({ ref }));
    // Far down the grid: not mounted while the page is at the top.
    expect(container.querySelector('[aria-posinset="40"]')).toBeNull();

    let link: HTMLElement | null = null;
    act(() => {
      link = ref.current?.reveal(39) ?? null;
    });
    expect(window.scrollTo).toHaveBeenCalled();
    expect(link).not.toBeNull();
    expect(link!.getAttribute("href")).toBe(`/m/${(39).toString(32).padStart(10, "0")}`);
  });
});
