import { vi } from "vitest";

// jsdom has no layout, ResizeObserver, matchMedia or scrolling. These stubs give the grid a
// width, which the observer reports as soon as it starts, as a browser's does, so the grid
// switches to its pixel layout; and they let preference hooks and scrolls run.

class StubResizeObserver {
  callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe() {
    this.callback([], this as unknown as ResizeObserver);
  }
  unobserve() {}
  disconnect() {}
}

export function installDomStubs({ width = 1024 }: { width?: number } = {}): void {
  vi.stubGlobal("ResizeObserver", StubResizeObserver);
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(width);
  // scrollTo moves scrollY, as a real scroll would (no scroll event: the code under test reads it).
  Object.defineProperty(window, "scrollY", { configurable: true, writable: true, value: 0 });
  vi.spyOn(window, "scrollTo").mockImplementation(((options: ScrollToOptions) => {
    window.scrollY = options.top ?? 0;
  }) as typeof window.scrollTo);
}

export function removeDomStubs(): void {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.scrollY = 0;
}
