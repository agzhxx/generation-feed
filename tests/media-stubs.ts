import { vi } from "vitest";

// jsdom can't play media. installMediaStubs() stubs play/pause/load, keeps track of which videos
// are playing (isPlaying), and records requestVideoFrameCallback, so a test can "paint a frame"
// with paintFrame(video).

type FrameCallback = () => void;
const frameCallbacks = new Map<HTMLVideoElement, Map<number, FrameCallback>>();
let nextFrameId = 1;
let playing = new WeakSet<HTMLMediaElement>();

export function installMediaStubs(): void {
  playing = new WeakSet();
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (this: HTMLMediaElement) {
    playing.add(this);
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (this: HTMLMediaElement) {
    playing.delete(this);
  });
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(function (this: HTMLMediaElement) {
    playing.delete(this);
  });
  frameCallbacks.clear();
  Object.defineProperty(HTMLVideoElement.prototype, "requestVideoFrameCallback", {
    configurable: true,
    value(this: HTMLVideoElement, callback: FrameCallback) {
      const id = nextFrameId++;
      const callbacks = frameCallbacks.get(this) ?? new Map<number, FrameCallback>();
      callbacks.set(id, callback);
      frameCallbacks.set(this, callbacks);
      return id;
    },
  });
  Object.defineProperty(HTMLVideoElement.prototype, "cancelVideoFrameCallback", {
    configurable: true,
    value(this: HTMLVideoElement, id: number) {
      frameCallbacks.get(this)?.delete(id);
    },
  });
}

export function removeMediaStubs(): void {
  vi.restoreAllMocks();
  delete (HTMLVideoElement.prototype as Partial<HTMLVideoElement>).requestVideoFrameCallback;
  delete (HTMLVideoElement.prototype as Partial<HTMLVideoElement>).cancelVideoFrameCallback;
}

/** Fires every pending frame callback of this video, as if a frame reached the screen. */
export function paintFrame(video: HTMLVideoElement): void {
  const callbacks = frameCallbacks.get(video) ?? new Map<number, FrameCallback>();
  frameCallbacks.set(video, new Map());
  for (const callback of callbacks.values()) callback();
}

/** Whether play() was the last of play, pause and load called on this video. */
export function isPlaying(video: HTMLMediaElement | null | undefined): boolean {
  return video ? playing.has(video) : false;
}
