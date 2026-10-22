// Measures the JavaScript a browser downloads to load a page (first-load JS), in gzip bytes.
// `next build` no longer prints this, so we load the page in Chromium, collect every script
// it requests, and gzip each one ourselves so the number doesn't depend on the server.
//
// Usage: pnpm build && pnpm start, then in another terminal: pnpm measure:js [url]
import { chromium } from "@playwright/test";
import { gzipSync } from "node:zlib";

const pageUrl = process.argv[2] ?? "http://localhost:3000/";

const browser = await chromium.launch();
const page = await browser.newPage();
const scriptUrls = new Set<string>();
page.on("request", (request) => {
  if (request.resourceType() === "script") scriptUrls.add(request.url());
});
await page.goto(pageUrl, { waitUntil: "networkidle" });
await browser.close();

const rows = await Promise.all(
  [...scriptUrls].map(async (url) => {
    const body = Buffer.from(await (await fetch(url)).arrayBuffer());
    return { file: new URL(url).pathname, raw: body.length, gzip: gzipSync(body).length };
  }),
);
rows.sort((a, b) => b.gzip - a.gzip);

const kb = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;
for (const row of rows) console.log(`${kb(row.gzip).padStart(10)}  ${row.file}`);
const totalGzip = rows.reduce((sum, row) => sum + row.gzip, 0);
const totalRaw = rows.reduce((sum, row) => sum + row.raw, 0);
console.log(`\n${rows.length} scripts · ${kb(totalGzip)} gzip · ${kb(totalRaw)} raw`);
