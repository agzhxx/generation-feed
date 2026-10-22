import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { MediaDetail, type MediaDetailProps } from "@/components/detail/MediaDetail";
import { makeItem, makeVideo } from "./fixtures";

const ORIGINS = { posters: "https://posters.example.com", videos: "https://videos.example.com" };

function renderDetail(props: Partial<MediaDetailProps> = {}) {
  return render(
    <MediaDetail
      item={makeItem({ prompt: "Neon city at dusk" })}
      mediaOrigins={ORIGINS}
      position={12}
      total={1284}
      previousHref="/m/bbbbbbbbbb"
      nextHref="/m/cccccccccc"
      {...props}
    />,
  );
}

afterEach(() => vi.restoreAllMocks());

describe("MediaDetail", () => {
  test("a story clip opens the robot story in the Timeline; other items have no such link", () => {
    const { unmount } = renderDetail({ item: makeVideo({ collection: "story", shot: "07-medium" }) });
    const link = screen.getByRole("link", { name: "Open in Timeline" });
    expect(link.getAttribute("href")).toBe("https://storyboard-timeline.vercel.app/?demo=story");
    unmount();
    renderDetail({ item: makeVideo({ collection: "camera-moves", cameraMove: "whip-pan" }) });
    expect(screen.queryByRole("link", { name: "Open in Timeline" })).toBeNull();
  });

  test("shows the prompt, the AI label and the facts", () => {
    const { container } = renderDetail();
    expect(screen.getByText("Neon city at dusk")).toBeTruthy();
    expect(screen.getByText("AI-generated")).toBeTruthy();
    const facts = [...container.querySelectorAll("dt")].map((dt) => `${dt.textContent}: ${dt.nextElementSibling?.textContent}`);
    expect(facts).toEqual([
      "Model: Grid Studio",
      "Type: Image",
      "Aspect ratio: 4:5",
      "Size: 1024 × 1280",
      "Created: 1 Oct 2026",
    ]);
    expect(container.querySelector("time")?.getAttribute("datetime")).toBe("2026-10-01T12:00:00.000Z");
    expect(screen.getAllByText("12 of 1,284").length).toBeGreaterThan(0);
  });

  test("an image gets a large poster named by its prompt", () => {
    renderDetail();
    const image = screen.getByRole("img", { name: "Neon city at dusk" });
    expect(image.getAttribute("fetchpriority")).toBe("high");
    expect(image.previousElementSibling?.getAttribute("srcset")).toContain(`${ORIGINS.posters}/m/aaaaaaaaaa/v1/960.webp 960w`);
  });

  test("a video plays in full with native controls", () => {
    const { container } = renderDetail({ item: makeVideo(), autoPlay: true });
    const video = container.querySelector("video");
    expect(video?.getAttribute("src")).toBe(`${ORIGINS.videos}/m/vvvvvvvvvv/v1/full.mp4`);
    expect(video?.getAttribute("poster")).toMatch(new RegExp(`^${ORIGINS.posters}/`));
    expect(video?.controls).toBe(true);
    expect(video?.muted).toBe(true);
    expect(screen.getAllByText("Video · 5 s").length).toBe(1);
  });

  test("on the static page, Close and the arrows are plain links", () => {
    renderDetail();
    for (const link of screen.getAllByRole("link", { name: "Back to feed" })) {
      expect(link.getAttribute("href")).toBe("/");
    }
    expect(screen.getAllByRole("link", { name: "Previous item" })[0].getAttribute("href")).toBe("/m/bbbbbbbbbb");
    expect(screen.getAllByRole("link", { name: "Next item" })[0].getAttribute("href")).toBe("/m/cccccccccc");
  });

  test("there is no previous link on the first item", () => {
    renderDetail({ previousHref: null });
    expect(screen.queryByRole("link", { name: "Previous item" })).toBeNull();
  });

  test("in the overlay, plain clicks step in place and modified clicks open the link", () => {
    const onNext = vi.fn();
    const onClose = vi.fn();
    renderDetail({ onNext, onClose });
    const next = screen.getAllByRole("link", { name: "Next item" })[0];

    const plain = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
    next.dispatchEvent(plain);
    expect(plain.defaultPrevented).toBe(true);
    expect(onNext).toHaveBeenCalledTimes(1);

    const withCmd = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, metaKey: true });
    next.dispatchEvent(withCmd);
    expect(withCmd.defaultPrevented).toBe(false);
    expect(onNext).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getAllByRole("button", { name: "Close" })[0]);
    expect(onClose).toHaveBeenCalled();
  });

  test("Copy prompt copies, says so, then resets", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    renderDetail();

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Copy prompt" })));
    expect(writeText).toHaveBeenCalledWith("Neon city at dusk");
    expect(screen.getByRole("button", { name: "Copied" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Prompt copied");

    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByRole("button", { name: "Copy prompt" })).toBeTruthy();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  test("Copy prompt says when the clipboard refuses", async () => {
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: () => Promise.reject(new Error("denied")) } });
    renderDetail();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Copy prompt" })));
    expect(screen.getByRole("button", { name: "Couldn't copy" })).toBeTruthy();
    vi.unstubAllGlobals();
  });
});
