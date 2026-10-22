import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { SEARCH_DEBOUNCE_MS } from "@/components/feed/FilterBar";
import { Header, type HeaderProps } from "@/components/feed/Header";

const MODELS = [
  { slug: "bars-lab", name: "Bars Lab" },
  { slug: "grid-studio", name: "Grid Studio" },
];
const COLLECTIONS = [
  { slug: "worlds", name: "Worlds" },
  { slug: "camera-moves", name: "Camera moves" },
];

function renderHeader(props: Partial<HeaderProps> = {}) {
  const onFiltersChange = vi.fn<HeaderProps["onFiltersChange"]>();
  const view = render(<Header filters={{}} models={MODELS} collections={COLLECTIONS} total={340} onFiltersChange={onFiltersChange} {...props} />);
  return { ...view, onFiltersChange };
}

const searchBox = () => screen.getByRole("searchbox", { name: "Search prompts" }) as HTMLInputElement;

afterEach(() => vi.useRealTimers());

describe("Header", () => {
  test("the type chips show the current kind and change it, keeping the other filters", () => {
    const { onFiltersChange } = renderHeader({ filters: { kind: "image", q: "neon" } });
    expect(screen.getByRole("button", { name: "Images" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "Videos" }));
    expect(onFiltersChange).toHaveBeenCalledWith({ kind: "video", q: "neon" });
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    expect(onFiltersChange).toHaveBeenLastCalledWith({ kind: undefined, q: "neon" });
  });

  test("the model select lists every model and changes the model", () => {
    const { onFiltersChange } = renderHeader();
    const select = screen.getByRole("combobox", { name: "Model" }) as HTMLSelectElement;
    expect([...select.options].map((option) => option.text)).toEqual(["All models", "Bars Lab", "Grid Studio"]);
    fireEvent.change(select, { target: { value: "grid-studio" } });
    expect(onFiltersChange).toHaveBeenCalledWith({ model: "grid-studio" });
    fireEvent.change(select, { target: { value: "" } });
    expect(onFiltersChange).toHaveBeenLastCalledWith({ model: undefined });
  });

  test("search waits for typing to pause, and sends the trimmed text", () => {
    vi.useFakeTimers();
    const { onFiltersChange } = renderHeader();
    fireEvent.change(searchBox(), { target: { value: "neon " } });
    act(() => vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 1));
    expect(onFiltersChange).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onFiltersChange).toHaveBeenCalledWith({ q: "neon" });
  });

  test("the collection select lists the collections and changes the collection, keeping the other filters", () => {
    const { onFiltersChange } = renderHeader({ filters: { kind: "video" } });
    const select = screen.getByRole("combobox", { name: "Collection" }) as HTMLSelectElement;
    expect([...select.options].map((option) => option.text)).toEqual(["All collections", "Worlds", "Camera moves"]);
    fireEvent.change(select, { target: { value: "camera-moves" } });
    expect(onFiltersChange).toHaveBeenCalledWith({ kind: "video", collection: "camera-moves" });
    fireEvent.change(select, { target: { value: "" } });
    expect(onFiltersChange).toHaveBeenLastCalledWith({ kind: "video", collection: undefined });
  });

  test("media without collections gets no collection select", () => {
    renderHeader({ collections: [] });
    expect(screen.queryByRole("combobox", { name: "Collection" })).toBeNull();
    expect(screen.getByRole("combobox", { name: "Model" })).toBeTruthy();
  });

  test("phones: the Filters button shows how many pickers are set and opens them in a sheet", () => {
    const { onFiltersChange } = renderHeader({ filters: { kind: "video", collection: "worlds" }, total: 35 });
    const button = screen.getByRole("button", { name: /^Filters/ });
    expect(button.textContent).toContain("1");
    expect(button.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(button);
    const sheet = screen.getByRole("dialog", { name: "Filters" }) as HTMLDialogElement;
    expect(sheet.open).toBe(true);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    // Choices apply at once, keeping the other filters.
    fireEvent.change(within(sheet).getByRole("combobox", { name: "Collection" }), { target: { value: "camera-moves" } });
    expect(onFiltersChange).toHaveBeenCalledWith({ kind: "video", collection: "camera-moves" });
    fireEvent.click(within(sheet).getByRole("button", { name: "Clear" }));
    expect(onFiltersChange).toHaveBeenLastCalledWith({ kind: "video", model: undefined, collection: undefined });

    fireEvent.click(within(sheet).getByRole("button", { name: "Show 35 results" }));
    expect(sheet.open).toBe(false);
    expect(button.getAttribute("aria-expanded")).toBe("false");
  });

  test("the sheet closes from Esc or a tap on the backdrop, and has no Clear button when nothing is set", () => {
    renderHeader();
    const button = screen.getByRole("button", { name: /^Filters/ });
    fireEvent.click(button);
    const sheet = screen.getByRole("dialog", { name: "Filters" }) as HTMLDialogElement;
    expect(within(sheet).queryByRole("button", { name: "Clear" })).toBeNull();
    // The browser fires "close" after Esc.
    act(() => sheet.close());
    expect(button.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(button);
    fireEvent.click(sheet);
    expect(sheet.open).toBe(false);
  });

  test("the box keeps what was typed, and follows the URL when it changes elsewhere", () => {
    const { rerender, onFiltersChange } = renderHeader();
    fireEvent.change(searchBox(), { target: { value: "neon " } });
    rerender(<Header filters={{ q: "neon" }} models={MODELS} collections={COLLECTIONS} total={54} onFiltersChange={onFiltersChange} />);
    expect(searchBox().value).toBe("neon ");
    // "Clear filters" elsewhere on the page.
    rerender(<Header filters={{}} models={MODELS} collections={COLLECTIONS} total={340} onFiltersChange={onFiltersChange} />);
    expect(searchBox().value).toBe("");
  });

  test("the clear button empties the search at once", () => {
    const { onFiltersChange } = renderHeader({ filters: { kind: "video", q: "sand" } });
    expect(searchBox().value).toBe("sand");
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(onFiltersChange).toHaveBeenCalledWith({ kind: "video", q: undefined });
    expect(searchBox().value).toBe("");
  });

  test("screen readers hear the count from one live region", () => {
    const { container, rerender, onFiltersChange } = renderHeader();
    const live = container.querySelector("[aria-live]");
    expect(live?.textContent).toBe("340 results");
    rerender(<Header filters={{}} models={MODELS} collections={COLLECTIONS} total={1} onFiltersChange={onFiltersChange} />);
    expect(live?.textContent).toBe("1 result");
    expect(container.querySelectorAll("[aria-live]")).toHaveLength(1);
  });
});
