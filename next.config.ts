import type { NextConfig } from "next";

/** The R2 bucket's public origin, e.g. its r2.dev address. */
const BUCKET_ORIGIN = process.env.NEXT_PUBLIC_MEDIA_ORIGIN;

/** A poster file, m/<id>/v<version>/<width>.<avif|webp> (lib/media-urls.ts). */
const POSTER_PATH = "/m/:id/:version/:file(\\d+\\.(?:avif|webp))";
const POSTER_IN_BUCKET = `${BUCKET_ORIGIN}/m/:id/:version/:file`;

/** A request for part of a file. Browsers never send one for an image. */
const RANGE = { type: "header", key: "range" } as const;

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // The CSS (about 5 KB gzip) ships inside the HTML, so the server-rendered first screen can
    // paint without waiting for a stylesheet request, which JavaScript could overtake.
    inlineCss: true,
  },
  // Posters load from the site's own address (lib/media-urls.ts): Vercel fetches them from the
  // bucket and its CDN caches them. The CDN keys that cache on the address alone, so the answer
  // to a request for part of a file would be replayed to everyone: such
  // requests go to the bucket itself instead. Without a bucket origin there's nowhere to send them.
  async redirects() {
    return BUCKET_ORIGIN ? [{ source: POSTER_PATH, has: [RANGE], destination: POSTER_IN_BUCKET, permanent: false }] : [];
  },
  async rewrites() {
    return BUCKET_ORIGIN ? [{ source: POSTER_PATH, missing: [RANGE], destination: POSTER_IN_BUCKET }] : [];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
