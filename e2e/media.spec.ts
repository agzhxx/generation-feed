import { expect, test } from "@playwright/test";
import { manifest } from "./helpers";

// The address rules for media in next.config.ts. Nothing here reaches the bucket: the redirect
// and the 404 come from the site itself.

const image = manifest.find((item) => item.kind === "image")!;
const video = manifest.find((item) => item.kind === "video")!;

test("a request for part of a poster goes to the bucket, so the site's CDN only caches whole files", async ({ request, baseURL }) => {
  const response = await request.get(`/${image.posterKey}/320.avif`, { headers: { range: "bytes=0-1" }, maxRedirects: 0 });
  expect(response.status()).toBe(307);
  const location = new URL(response.headers()["location"]);
  expect(location.origin).not.toBe(new URL(baseURL!).origin);
  expect(location.pathname).toBe(`/${image.posterKey}/320.avif`);
});

test("videos aren't served from the site's address", async ({ request }) => {
  const response = await request.get(`/${video.previewKey}`, { maxRedirects: 0 });
  expect(response.status()).toBe(404);
});
