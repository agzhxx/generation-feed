import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createVideoPool, defaultPoolSize, type VideoPool } from "@/lib/video-pool";
import { installMediaStubs, paintFrame, removeMediaStubs } from "./media-stubs";

let pool: VideoPool | undefined;

function slot(): HTMLDivElement {
  return document.body.appendChild(document.createElement("div"));
}

const src = (card: string) => `https://media.example.com/m/${card}/preview.mp4`;

beforeEach(installMediaStubs);

afterEach(() => {
  pool?.dispose();
  pool = undefined;
  removeMediaStubs();
  document.body.innerHTML = "";
});

describe("createVideoPool", () => {
  test("its videos are muted, inline, looping and never picture-in-picture", () => {
    pool = createVideoPool(2);
    const video = pool.acquire("a", src("a"), slot());
    expect(video.muted).toBe(true);
    expect(video.playsInline).toBe(true);
    expect(video.loop).toBe(true);
    expect(video.hasAttribute("disablepictureinpicture")).toBe(true);
  });

  test("acquire moves a video into the card's slot, loads the card's source and plays it", () => {
    pool = createVideoPool(2);
    const target = slot();
    const video = pool.acquire("a", src("a"), target);
    expect(video.parentElement).toBe(target);
    expect(video.getAttribute("src")).toBe(src("a"));
    expect(video.preload).toBe("auto");
    expect(video.play).toHaveBeenCalled();
    expect(pool.liveCount()).toBe(1);
  });

  test("uses a free video before taking one from another card", () => {
    pool = createVideoPool(2);
    const a = pool.acquire("a", src("a"), slot());
    const b = pool.acquire("b", src("b"), slot());
    expect(a).not.toBe(b);
    expect(pool.steals()).toBe(0);
  });

  test("never makes more than `size` videos, however many cards ask", () => {
    pool = createVideoPool(3);
    const videos = new Set<HTMLVideoElement>();
    for (let card = 0; card < 20; card++) {
      videos.add(pool.acquire(`card${card}`, src(`card${card}`), slot()));
      pool.release(`card${card}`);
      expect(pool.liveCount()).toBeLessThanOrEqual(3);
    }
    expect(videos.size).toBe(3);
  });

  test("release pauses the video but keeps its source: the card stays warm", () => {
    pool = createVideoPool(2);
    const video = pool.acquire("a", src("a"), slot());
    pool.release("a");
    expect(video.pause).toHaveBeenCalled();
    expect(video.getAttribute("src")).toBe(src("a"));
    expect(pool.liveCount()).toBe(1);
  });

  test("a warm card gets its own video back without reloading it", () => {
    pool = createVideoPool(3);
    const first = pool.acquire("a", src("a"), slot());
    pool.release("a");
    pool.acquire("b", src("b"), slot());
    pool.release("b");
    const loadCalls = vi.mocked(first.load).mock.calls.length;

    const again = pool.acquire("a", src("a"), slot());
    expect(again).toBe(first);
    expect(again.getAttribute("src")).toBe(src("a"));
    expect(vi.mocked(first.load).mock.calls.length).toBe(loadCalls);
    expect(pool.steals()).toBe(0);
  });

  test("when every video is taken, it steals the least recently used one", () => {
    pool = createVideoPool(2);
    const a = pool.acquire("a", src("a"), slot());
    pool.release("a");
    const b = pool.acquire("b", src("b"), slot());
    pool.release("b");

    const c = pool.acquire("c", src("c"), slot());
    expect(c).toBe(a); // "a" was used longest ago
    expect(c).not.toBe(b);
    expect(c.getAttribute("src")).toBe(src("c"));
    expect(pool.steals()).toBe(1);
  });

  test("stealing frees the decoder first: pause, remove the source, load()", () => {
    pool = createVideoPool(1);
    const video = pool.acquire("a", src("a"), slot());
    pool.release("a");
    const calls: string[] = [];
    vi.mocked(video.pause).mockImplementation(() => void calls.push("pause"));
    vi.mocked(video.load).mockImplementation(() => void calls.push(`load (src: ${video.getAttribute("src")})`));

    pool.acquire("b", src("b"), slot());
    expect(calls.slice(0, 2)).toEqual(["pause", "load (src: null)"]);
  });

  test("prefers stealing an idle video over a playing one", () => {
    pool = createVideoPool(2);
    const playing = pool.acquire("a", src("a"), slot()); // used first, still playing
    const idle = pool.acquire("b", src("b"), slot());
    pool.release("b");
    expect(pool.acquire("c", src("c"), slot())).toBe(idle);
    expect(pool.acquire("a", src("a"), slot())).toBe(playing);
  });

  test("if every video is playing, it takes the least recently used one and tells that card", () => {
    pool = createVideoPool(2);
    const onLost = vi.fn();
    const a = pool.acquire("a", src("a"), slot(), { onLost });
    pool.acquire("b", src("b"), slot());
    expect(pool.acquire("c", src("c"), slot())).toBe(a);
    expect(onLost).toHaveBeenCalledOnce();
  });

  test("onFirstFrame fires only when a frame is actually painted", () => {
    pool = createVideoPool(2);
    const onFirstFrame = vi.fn();
    const video = pool.acquire("a", src("a"), slot(), { onFirstFrame });
    expect(onFirstFrame).not.toHaveBeenCalled();
    paintFrame(video);
    expect(onFirstFrame).toHaveBeenCalledOnce();
  });

  test("releasing before the first frame cancels onFirstFrame", () => {
    pool = createVideoPool(2);
    const onFirstFrame = vi.fn();
    const video = pool.acquire("a", src("a"), slot(), { onFirstFrame });
    pool.release("a");
    paintFrame(video);
    expect(onFirstFrame).not.toHaveBeenCalled();
  });

  test("without requestVideoFrameCallback, the first frame falls back to loadeddata", () => {
    delete (HTMLVideoElement.prototype as Partial<HTMLVideoElement>).requestVideoFrameCallback;
    pool = createVideoPool(2);
    const onFirstFrame = vi.fn();
    const video = pool.acquire("a", src("a"), slot(), { onFirstFrame });
    video.dispatchEvent(new Event("loadeddata"));
    expect(onFirstFrame).toHaveBeenCalledOnce();
  });

  test("a refused play() is reported; an interrupted one is not", async () => {
    pool = createVideoPool(2);
    const onPlayRejected = vi.fn();
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementationOnce(() =>
      Promise.reject(new DOMException("Low Power Mode", "NotAllowedError")),
    );
    pool.acquire("a", src("a"), slot(), { onPlayRejected });
    vi.mocked(HTMLMediaElement.prototype.play).mockImplementationOnce(() =>
      Promise.reject(new DOMException("pause() interrupted play()", "AbortError")),
    );
    const interrupted = vi.fn();
    pool.acquire("b", src("b"), slot(), { onPlayRejected: interrupted });

    await vi.waitFor(() => expect(onPlayRejected).toHaveBeenCalledOnce());
    expect(interrupted).not.toHaveBeenCalled();
  });

  test("pauses every video when the tab is hidden, and resumes the ones in use when it's back", () => {
    pool = createVideoPool(2);
    const playing = pool.acquire("a", src("a"), slot());
    pool.acquire("b", src("b"), slot());
    pool.release("b");
    const setHidden = (hidden: boolean) => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
      document.dispatchEvent(new Event("visibilitychange"));
    };

    vi.mocked(HTMLMediaElement.prototype.pause).mockClear();
    setHidden(true);
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalledTimes(2);

    vi.mocked(HTMLMediaElement.prototype.play).mockClear();
    setHidden(false);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledOnce();
    expect(vi.mocked(HTMLMediaElement.prototype.play).mock.contexts[0]).toBe(playing);
    delete (document as Partial<Document> & { hidden?: boolean }).hidden;
  });

  test("the first click starts and pauses every video not in use, once", () => {
    pool = createVideoPool(3);
    const playing = pool.acquire("a", src("a"), slot());
    const play = vi.mocked(HTMLMediaElement.prototype.play);
    const pause = vi.mocked(HTMLMediaElement.prototype.pause);
    play.mockClear();
    pause.mockClear();

    document.body.click();
    expect(play).toHaveBeenCalledTimes(2);
    expect(play.mock.contexts).not.toContain(playing);
    expect(pause.mock.contexts).toEqual(play.mock.contexts);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    expect(play).toHaveBeenCalledTimes(2);
  });

  test("a touch the browser doesn't count as a click (a scroll) waits for the next one", () => {
    pool = createVideoPool(2);
    const activation = { isActive: false };
    Object.defineProperty(navigator, "userActivation", { configurable: true, get: () => activation });
    const play = vi.mocked(HTMLMediaElement.prototype.play);

    document.dispatchEvent(new Event("touchend"));
    expect(play).not.toHaveBeenCalled();

    activation.isActive = true;
    document.dispatchEvent(new Event("touchend"));
    expect(play).toHaveBeenCalledTimes(2);
    delete (navigator as Partial<Navigator> & { userActivation?: unknown }).userActivation;
  });

  test("dispose empties every video and stops listening", () => {
    pool = createVideoPool(2);
    const video = pool.acquire("a", src("a"), slot());
    pool.dispose();
    expect(video.getAttribute("src")).toBeNull();
    expect(video.isConnected).toBe(false);
    expect(pool.liveCount()).toBe(0);
    vi.mocked(HTMLMediaElement.prototype.play).mockClear();
    document.body.click();
    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
  });
});

describe("defaultPoolSize", () => {
  test("6 on a mouse-driven device with enough memory, or memory unknown", () => {
    expect(defaultPoolSize({ touch: false, deviceMemory: 8 })).toBe(6);
    expect(defaultPoolSize({ touch: false })).toBe(6);
  });

  test("2 on a touch screen or with 4 GB of memory or less", () => {
    expect(defaultPoolSize({ touch: true, deviceMemory: 8 })).toBe(2);
    expect(defaultPoolSize({ touch: false, deviceMemory: 4 })).toBe(2);
  });
});
