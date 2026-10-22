import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { Feed } from "@/components/feed/Feed";
import type { FeedPage } from "@/lib/feed";
import type { MediaItem } from "@/lib/manifest";
import { installDomStubs, removeDomStubs } from "./dom-stubs";
import { makeItem, makeVideo } from "./fixtures";

const MODELS = [{ slug: "grid-studio", name: "Grid Studio" }];

function page(items: MediaItem[], total = items.length): FeedPage {
  return { items, nextCursor: null, total };
}

const images = [makeItem({ id: "aaaaaaaaaa" }), makeItem({ id: "bbbbbbbbbb" }), makeItem({ id: "cccccccccc" })];

beforeEach(() => {
  installDomStubs();
  window.history.replaceState(null, "", "/");
});
afterEach(() => {
  removeDomStubs();
  window.history.replaceState(null, "", "/");
});

describe("Feed", () => {
  test("a filter goes into the URL without a new history entry, and the API gets it", async () => {
    const fetch = vi.fn<(url: string) => Promise<Response>>(async () => Response.json(page([makeVideo()])));
    vi.stubGlobal("fetch", fetch);
    render(<Feed firstPage={page(images)} models={MODELS} collections={[]} />);
    const entries = window.history.length;

    fireEvent.click(screen.getByRole("button", { name: "Videos" }));
    expect(window.location.search).toBe("?kind=video");
    expect(window.history.length).toBe(entries);
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "instant" });

    await waitFor(() => expect(screen.getAllByRole("listitem")).toHaveLength(1));
    expect(fetch.mock.calls[0][0]).toBe("/api/media?kind=video&limit=40");
    expect(screen.getByText("1 result", { selector: "[aria-live]" })).toBeTruthy();
  });

  test("a search with no matches shows the empty state, and Clear filters shows everything again", async () => {
    window.history.replaceState(null, "", "/?q=zzzz");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(page([]))));
    render(<Feed firstPage={page(images)} models={MODELS} collections={[]} />);

    expect(await screen.findByRole("heading", { name: "No results for “zzzz”" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(window.location.pathname + window.location.search).toBe("/");
    expect(await screen.findAllByRole("listitem")).toHaveLength(3);
  });

  test("a failed request for new filters offers Retry", async () => {
    window.history.replaceState(null, "", "/?kind=video");
    const fetch = vi.fn(async () => new Response("", { status: 500 }));
    vi.stubGlobal("fetch", fetch);
    render(<Feed firstPage={page(images)} models={MODELS} collections={[]} />);

    // One quiet retry first (about a second), then the error row.
    expect(await screen.findByRole("alert", {}, { timeout: 3000 })).toBeTruthy();
    fetch.mockImplementation(async () => Response.json(page([makeVideo()])));
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });
});
