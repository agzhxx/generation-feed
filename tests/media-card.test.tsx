import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { MediaCard, type MediaCardProps } from "@/components/feed/MediaCard";
import { createMediaUrls, GRID_POSTER_SIZES } from "@/lib/media-urls";
import { makeItem, makeVideo } from "./fixtures";

const urls = createMediaUrls("https://media.example.com");

function renderCard(props: Partial<MediaCardProps> = {}) {
  const item = props.item ?? makeItem({ prompt: "Test pattern #001" });
  return render(
    <MediaCard item={item} href={`/m/${item.id}`} urls={urls} sizes={GRID_POSTER_SIZES} priority="lazy" {...props} />,
  );
}

afterEach(() => vi.useRealTimers());

describe("MediaCard", () => {
  test("is a link named by prompt, kind, model and the AI label", () => {
    renderCard();
    const link = screen.getByRole("link", {
      name: "Test pattern #001. Image, Grid Studio, AI-generated.",
    });
    expect(link.getAttribute("href")).toBe("/m/aaaaaaaaaa");
  });

  test("offers AVIF and WebP posters at every available width", () => {
    const { container } = renderCard();
    const [avif, webp] = container.querySelectorAll("source");
    expect(avif.getAttribute("type")).toBe("image/avif");
    expect(avif.getAttribute("srcset")).toContain("https://media.example.com/m/aaaaaaaaaa/v1/960.avif 960w");
    expect(webp.getAttribute("type")).toBe("image/webp");
    expect(avif.getAttribute("sizes")).toBe(GRID_POSTER_SIZES);
  });

  test("shows the ThumbHash first, then fades the poster in once it loads", () => {
    const { container } = renderCard();
    const blur = container.querySelector("img[data-placeholder]");
    expect(blur?.getAttribute("src")).toMatch(/^data:image\/png;base64,/);
    const poster = container.querySelector("picture img");
    expect(poster?.className).toContain("opacity-0");
    expect(poster?.getAttribute("loading")).toBe("lazy");
    fireEvent.load(poster!);
    expect(poster?.className).toContain("opacity-100");
  });

  test("the first poster loads eagerly with high priority and doesn't fade", () => {
    const { container } = renderCard({ priority: "high" });
    const poster = container.querySelector("picture img");
    expect(poster?.getAttribute("loading")).toBe("eager");
    expect(poster?.getAttribute("fetchpriority")).toBe("high");
    expect(poster?.className).not.toContain("opacity-0");
  });

  test("a video card says how long it is and starts its preview after the pointer rests", () => {
    vi.useFakeTimers();
    const renderPreview = vi.fn((_item, active: boolean) => <span data-testid="preview">{String(active)}</span>);
    renderCard({ item: makeVideo({ prompt: "Motion test #01" }), renderPreview });

    expect(screen.getByRole("link").textContent).toContain("Video · 5s");
    expect(screen.getByRole("link", { name: /Motion test #01\. Video, 5 seconds, Motion Test, AI-generated\./ })).toBeTruthy();
    expect(screen.getByTestId("preview").textContent).toBe("false");

    fireEvent.pointerEnter(screen.getByRole("link"), { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(99));
    expect(screen.getByTestId("preview").textContent).toBe("false");
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId("preview").textContent).toBe("true");

    fireEvent.pointerLeave(screen.getByRole("link"));
    expect(screen.getByTestId("preview").textContent).toBe("false");
  });

  test("touch doesn't start a preview on its own", () => {
    vi.useFakeTimers();
    renderCard({ item: makeVideo(), renderPreview: (_item, active) => <span data-testid="preview">{String(active)}</span> });
    fireEvent.pointerEnter(screen.getByRole("link"), { pointerType: "touch" });
    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByTestId("preview").textContent).toBe("false");
  });
});
