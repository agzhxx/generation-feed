import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { LoadError, NoResults, OfflineBanner } from "@/components/feed/states";

afterEach(() => vi.restoreAllMocks());

describe("NoResults", () => {
  test("names the search and clears the filters", () => {
    const onClear = vi.fn();
    render(<NoResults q="zzzz" onClear={onClear} />);
    expect(screen.getByRole("heading", { name: "No results for “zzzz”" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(onClear).toHaveBeenCalled();
  });

  test("without a search, just says there are no results", () => {
    render(<NoResults q={undefined} onClear={() => {}} />);
    expect(screen.getByRole("heading", { name: "No results" })).toBeTruthy();
  });
});

describe("LoadError", () => {
  test("is an alert with a Retry button", () => {
    const onRetry = vi.fn();
    render(<LoadError title="Couldn't load more items." onRetry={onRetry} />);
    expect(screen.getByRole("alert").textContent).toContain("Couldn't load more items.");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe("OfflineBanner", () => {
  test("shows while the browser is offline, inside a live region", () => {
    const onLine = vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
    render(<OfflineBanner />);
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("");

    onLine.mockReturnValue(false);
    act(() => void window.dispatchEvent(new Event("offline")));
    expect(status.textContent).toBe("You're offline. Showing what's already loaded.");

    onLine.mockReturnValue(true);
    act(() => void window.dispatchEvent(new Event("online")));
    expect(status.textContent).toBe("");
  });
});
