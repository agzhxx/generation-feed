import { render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { Feed } from "@/components/feed/Feed";
import { installDomStubs, removeDomStubs } from "./dom-stubs";
import { makeItem } from "./fixtures";

// Its own file: the page's one video pool is module state, and each test file starts fresh.

beforeEach(() => installDomStubs());
afterEach(removeDomStubs);

test("the video pool is made right after the first render, in a task of its own", async () => {
  const create = vi.spyOn(document, "createElement");
  const videosMade = () => create.mock.calls.filter(([tag]) => tag === "video").length;
  const firstPage = { items: [makeItem()], nextCursor: null, total: 1 };

  render(<Feed firstPage={firstPage} models={[]} collections={[]} />);
  expect(videosMade()).toBe(0);

  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(videosMade()).toBeGreaterThan(0);
  create.mockRestore();
});
