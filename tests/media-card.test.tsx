import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { feedBadges, getMediaUrl, toCardItem } from "@/components/feed/feed-cards";
import { MediaCard, type MediaCardProps } from "@/components/ui/media-card/media-card";
import { VideoPoolProvider } from "@/hooks/use-video-pool";
import type { MediaItem } from "@/lib/manifest";
import { GRID_POSTER_SIZES, POSTER_WIDTHS } from "@/lib/media-urls";
import { installDomStubs, removeDomStubs } from "./dom-stubs";
import { makeItem, makeVideo } from "./fixtures";
import { installMediaStubs, isPlaying, removeMediaStubs } from "./media-stubs";

// The feed's cards: the Genframe Kit's MediaCard (installed with `shadcn add`, and tested in the
// Kit) with the feed's names, URLs and badges (components/feed/feed-cards.tsx), as MediaGrid
// renders them. These pin what the feed shows.

type CardProps = Partial<Omit<MediaCardProps<ReturnType<typeof toCardItem>>, "item">>;

function card(item: MediaItem, props: CardProps = {}) {
  const cardItem = toCardItem(item);
  return (
    <VideoPoolProvider size={2}>
      <MediaCard
        item={cardItem}
        getMediaUrl={getMediaUrl}
        widths={POSTER_WIDTHS}
        href={`/m/${item.id}`}
        sizes={GRID_POSTER_SIZES}
        {...props}
      >
        {feedBadges(cardItem)}
      </MediaCard>
    </VideoPoolProvider>
  );
}

function renderCard(item: MediaItem = makeItem({ prompt: "Test pattern #001" }), props: CardProps = {}) {
  const view = render(card(item, props));
  return {
    ...view,
    link: () => screen.getByRole("link"),
    media: () => view.container.querySelector<HTMLElement>('[data-slot="media-card-media"]'),
    placeholder: () => view.container.querySelector<HTMLImageElement>('[data-slot="media-card-placeholder"]'),
    poster: () => view.container.querySelector<HTMLImageElement>("picture img"),
    previewState: () =>
      isPlaying(view.container.querySelector<HTMLVideoElement>('[data-slot="media-card-preview"] video')) ? "playing" : "idle",
    rerenderCard: (next: CardProps) => view.rerender(card(item, next)),
  };
}

beforeEach(() => {
  installDomStubs();
  installMediaStubs();
});

afterEach(() => {
  // Unmounted first: the cards give their videos back, with the stubs still there.
  cleanup();
  removeMediaStubs();
  removeDomStubs();
  vi.useRealTimers();
});

describe("MediaCard in the feed", () => {
  test("is a link named by prompt, kind, model and the AI label", () => {
    const { link } = renderCard();
    expect(screen.getByRole("link", { name: "Test pattern #001. Image, Grid Studio, AI-generated." })).toBe(link());
    expect(link().getAttribute("href")).toBe("/m/aaaaaaaaaa");
  });

  test("offers AVIF and WebP posters at every available width, from the site's own address", () => {
    const { container, poster } = renderCard();
    const [avif] = container.querySelectorAll("source");
    expect(avif.getAttribute("type")).toBe("image/avif");
    expect(avif.getAttribute("srcset")).toContain("/m/aaaaaaaaaa/v1/960.avif 960w");
    expect(avif.getAttribute("sizes")).toBe(GRID_POSTER_SIZES);
    expect(poster()?.getAttribute("srcset")).toContain("/m/aaaaaaaaaa/v1/960.webp 960w");
    // The source is 1,024 px wide: no 1,280 px poster exists.
    expect(avif.getAttribute("srcset")).not.toContain("1280");
    expect(poster()?.getAttribute("src")).toBe("/m/aaaaaaaaaa/v1/640.webp");
  });

  test("shows the ThumbHash first, then fades the poster in once it loads", () => {
    const { placeholder, poster } = renderCard();
    expect(placeholder()?.getAttribute("src")).toMatch(/^data:image\/png;base64,/);
    expect(poster()?.className).toContain("opacity-0");
    expect(poster()?.getAttribute("loading")).toBe("lazy");
    fireEvent.load(poster()!);
    expect(poster()?.className).not.toContain("opacity-0");
  });

  test("in server HTML: an average-color placeholder, and posters visible without JavaScript", () => {
    const { media, placeholder, poster } = renderCard(undefined, { placeholder: "color" });
    expect(placeholder()).toBeNull();
    expect(media()?.style.backgroundColor).toMatch(/^rgb\(/);
    // Even a lazy poster must not wait for an onLoad that never fires without JavaScript.
    expect(poster()?.className).not.toContain("opacity-0");
  });

  test("the first poster loads eagerly with high priority and doesn't fade", () => {
    const { poster } = renderCard(undefined, { priority: "high" });
    expect(poster()?.getAttribute("loading")).toBe("eager");
    expect(poster()?.getAttribute("fetchpriority")).toBe("high");
    expect(poster()?.className).not.toContain("opacity-0");
  });

  test("a video card says how long it is and starts its preview after the pointer rests", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { link, previewState } = renderCard(makeVideo({ prompt: "Motion test #01" }));

    expect(link().textContent).toContain("Video · 5s");
    expect(screen.getByRole("link", { name: /Motion test #01\. Video, 5 seconds, Motion Test, AI-generated\./ })).toBeTruthy();
    expect(previewState()).toBe("idle");

    fireEvent.pointerEnter(link(), { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(99));
    expect(previewState()).toBe("idle");
    act(() => vi.advanceTimersByTime(1));
    expect(previewState()).toBe("playing");
    expect(link().querySelector("video")?.getAttribute("src")).toBe(
      `${process.env.NEXT_PUBLIC_MEDIA_ORIGIN ?? ""}/m/vvvvvvvvvv/v1/preview.mp4`,
    );

    fireEvent.pointerLeave(link());
    expect(previewState()).toBe("idle");
  });

  test("touch doesn't start a preview by itself, but the grid's center pick does", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { link, previewState, rerenderCard } = renderCard(makeVideo());
    fireEvent.pointerEnter(link(), { pointerType: "touch" });
    act(() => vi.advanceTimersByTime(500));
    expect(previewState()).toBe("idle");

    rerenderCard({ previewSince: 123 });
    expect(previewState()).toBe("playing");
  });

  test("with autoplay off (reduced motion, Save-Data), a play button starts and stops the preview", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { link, previewState } = renderCard(makeVideo(), { autoplay: false });
    fireEvent.pointerEnter(link(), { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(500));
    expect(previewState()).toBe("idle");

    fireEvent.click(screen.getByRole("button", { name: "Play preview" }));
    expect(previewState()).toBe("playing");
    fireEvent.click(screen.getByRole("button", { name: "Pause preview" }));
    expect(previewState()).toBe("idle");
  });

  test("when the browser refuses to play, the card falls back to its play button", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementationOnce(() =>
      Promise.reject(new DOMException("Low Power Mode", "NotAllowedError")),
    );
    const { link } = renderCard(makeVideo());
    expect(screen.queryByRole("button", { name: "Play preview" })).toBeNull();

    fireEvent.pointerEnter(link(), { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(100));
    expect(await screen.findByRole("button", { name: "Play preview" })).toBeTruthy();
  });

  test("a plain click calls onOpen instead of following the link", () => {
    const onOpen = vi.fn();
    const { link } = renderCard(undefined, { onOpen });
    const click = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    link().dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "aaaaaaaaaa" }), link());
  });

  test("Ctrl, Cmd and Shift clicks keep the link's own behavior (new tab, new window)", () => {
    const onOpen = vi.fn();
    const { link } = renderCard(undefined, { onOpen });
    for (const modifier of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }]) {
      const click = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...modifier });
      link().dispatchEvent(click);
      expect(click.defaultPrevented).toBe(false);
    }
    expect(onOpen).not.toHaveBeenCalled();
  });

  test("paused: no preview plays, even a hovered one", () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const { link, previewState, rerenderCard } = renderCard(makeVideo());
    fireEvent.pointerEnter(link(), { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(100));
    expect(previewState()).toBe("playing");

    rerenderCard({ paused: true });
    expect(previewState()).toBe("idle");
    rerenderCard({});
    expect(previewState()).toBe("playing");
  });

  test("a poster that fails keeps the placeholder and offers a retry", () => {
    const { placeholder, poster } = renderCard();
    fireEvent.error(poster()!);
    expect(poster()).toBeNull();
    expect(placeholder()).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Retry loading image" }));
    expect(poster()).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Retry loading image" })).toBeNull();
  });

  test("images never get a preview or a play button", () => {
    const { container } = renderCard(undefined, { autoplay: false });
    expect(container.querySelector('[data-slot="media-card-preview"]')).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
