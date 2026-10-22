import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, test } from "vitest";
import { feedHref, replaceFilters, useFeedFilters } from "@/components/feed/url-state";

afterEach(() => window.history.replaceState(null, "", "/"));

describe("useFeedFilters", () => {
  test("reads the filters in the address bar and ignores invalid ones", () => {
    window.history.replaceState(null, "", "/?kind=video&model=Bad%20Slug&q=neon");
    const { result } = renderHook(() => useFeedFilters());
    expect(result.current).toEqual({ kind: "video", q: "neon" });
  });

  test("follows replaceFilters and Back/Forward", () => {
    const { result } = renderHook(() => useFeedFilters());
    expect(result.current).toEqual({});
    act(() => replaceFilters({ model: "grid-studio" }));
    expect(window.location.search).toBe("?model=grid-studio");
    expect(result.current).toEqual({ model: "grid-studio" });
    act(() => {
      window.history.replaceState(null, "", "/?kind=image");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(result.current).toEqual({ kind: "image" });
  });

  test("keeps the feed's filters while the detail view owns the address", () => {
    window.history.replaceState(null, "", "/?kind=video");
    const { result } = renderHook(() => useFeedFilters());
    act(() => {
      window.history.pushState(null, "", "/m/aaaaaaaaaa");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(result.current).toEqual({ kind: "video" });
  });
});

describe("replaceFilters", () => {
  test("adds no history entry", () => {
    const before = window.history.length;
    replaceFilters({ kind: "image" });
    replaceFilters({ kind: "video", q: "sand" });
    expect(window.history.length).toBe(before);
    expect(window.location.search).toBe("?kind=video&q=sand");
  });
});

describe("feedHref", () => {
  test("puts filters first and keeps other params", () => {
    expect(feedHref({ q: "neon" }, "?perf=1&kind=video")).toBe("/?q=neon&perf=1");
    expect(feedHref({}, "?kind=video")).toBe("/");
  });
});
