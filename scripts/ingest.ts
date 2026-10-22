// Turns source files into web-ready media, writes data/manifest.json and uploads to R2.
// Per item: AVIF and WebP posters at every width up to the source's (lib/media-urls.ts), a
// JPEG for link previews and a ThumbHash. Videos also get a ~2.5 s muted preview and a 720p
// full clip; their poster is the first frame, the same frame the preview starts on, so the
// poster → video swap is seamless.
//
// Keys look like m/<id>/v<PIPELINE_VERSION>/640.avif. The id is a hash of the source file and
// PIPELINE_VERSION goes up whenever encoder settings change, so a key never changes in place:
// uploads skip keys that already exist and are sent with an immutable Cache-Control. Files are
// built into media-out/ first, which doubles as a cache, so a second run changes nothing.
//
// R2 free tier: before sending anything the upload checks that the bucket stays under half
// the free storage and that one run uses at most 10 % of the free monthly writes
// (scripts/r2-limits.ts). Keys confirmed on R2 go into media-out/.r2-<bucket>.txt, so later
// runs skip them without a single request.
//
// Usage:
//   pnpm media:ingest --dry-run     build media-out/ and the manifest, no upload
//   pnpm media:ingest               the same, then upload to R2 (reads .env.local)
//   --sources <file>                a sources.json to ingest; repeatable
//                                   (default: media-src/dev/sources.json)
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import { availableParallelism } from "node:os";
import path from "node:path";
import { parseArgs, promisify } from "node:util";
import { AwsClient } from "aws4fetch";
import sharp from "sharp";
import { rgbaToThumbHash } from "thumbhash";
import { z } from "zod";
import { compareItems, manifestSchema, type MediaItem } from "../lib/manifest.ts";
import {
  OG_IMAGE_WIDTH,
  ogImageKey,
  posterFileKey,
  posterWidths,
  type PosterFormat,
} from "../lib/media-urls.ts";
import { mapConcurrent } from "./pool.ts";
import { GUARD_SHARE, R2_FREE_TIER } from "./r2-limits.ts";
import { sourcesSchema, type SourceItem } from "./sources.ts";

const run = promisify(execFile);

const PIPELINE_VERSION = 1;
const OUT_DIR = "media-out";
const MANIFEST_PATH = "data/manifest.json";
const DEFAULT_SOURCES = "media-src/dev/sources.json";

const POSTER_FORMATS: readonly PosterFormat[] = ["avif", "webp"];
const PREVIEW_SECONDS = 2.5;
const PREVIEW_SHORT_SIDE = 480;
const FULL_SHORT_SIDE = 720;
const PREVIEW_BUDGET_BYTES = 300 * 1024;
// Worst case is about maxrate × 2.5 s + 0.9 × bufsize (x264 starts with a nearly full
// buffer): 700 kbit/s × 2.5 s + 630 kbit ≈ 290 KB, inside the budget.
const PREVIEW_MAXRATE = "700k";
const PREVIEW_BUFSIZE = "700k";

const UPLOAD_CONCURRENCY = 8;
const NETWORK_ATTEMPTS = 5;
/** One run may use at most this share of R2's free monthly writes. */
const RUN_WRITE_SHARE = 0.1;

const CACHE_CONTROL = "public, max-age=31536000, immutable";
const CONTENT_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".mp4": "video/mp4",
};

interface BuiltItem {
  item: MediaItem;
  keys: string[];
}

/** 50 bits of the file's SHA-256 in base32hex (0-9, a-v). */
function idFor(bytes: Buffer): string {
  const hex = createHash("sha256").update(bytes).digest("hex");
  return (BigInt(`0x${hex.slice(0, 13)}`) >> BigInt(2)).toString(32).padStart(10, "0");
}

/** Writes through a temp file, so an interrupted run never leaves a half file in the cache. */
async function produce(out: string, make: (tmp: string) => Promise<unknown>): Promise<void> {
  if (existsSync(out)) return;
  const tmp = out.replace(/(\.\w+)$/, ".tmp$1");
  await make(tmp);
  await rename(tmp, out);
}

function ffmpeg(args: string[]): Promise<unknown> {
  return run("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...args]);
}

/** `scale` filter that sets the short side to `side`, never upscaling. */
function scaleShortSide(width: number, height: number, side: number): string {
  const target = Math.min(side, width, height);
  return width >= height ? `scale=-2:${target}:flags=lanczos` : `scale=${target}:-2:flags=lanczos`;
}

const probeSchema = z.object({
  streams: z.array(
    z.object({ codec_type: z.string(), width: z.number().optional(), height: z.number().optional() }),
  ),
  format: z.object({ duration: z.string() }),
});

async function probeVideo(file: string) {
  const { stdout } = await run("ffprobe", [
    ...["-v", "error", "-show_entries", "stream=codec_type,width,height:format=duration"],
    ...["-of", "json", file],
  ]);
  const probe = probeSchema.parse(JSON.parse(String(stdout)));
  const video = probe.streams.find((stream) => stream.codec_type === "video");
  if (video?.width === undefined || video.height === undefined) {
    throw new Error(`No video stream in ${file}`);
  }
  return {
    width: video.width,
    height: video.height,
    durationSec: Math.round(Number(probe.format.duration) * 10) / 10,
    hasAudio: probe.streams.some((stream) => stream.codec_type === "audio"),
  };
}

async function buildItem(source: SourceItem, sourceDir: string): Promise<BuiltItem> {
  const sourcePath = path.join(sourceDir, source.file);
  const id = idFor(await readFile(sourcePath));
  const base = `m/${id}/v${PIPELINE_VERSION}`;
  const outBase = path.join(OUT_DIR, base);
  await mkdir(outBase, { recursive: true });
  const keys: string[] = [];

  let posterInput = sourcePath;
  let width: number;
  let height: number;
  let videoFields: Pick<MediaItem, "previewKey" | "videoKey" | "durationSec"> = {};

  if (source.kind === "image") {
    const meta = await sharp(sourcePath).metadata();
    const rotated = (meta.orientation ?? 1) >= 5;
    width = rotated ? meta.height : meta.width;
    height = rotated ? meta.width : meta.height;
  } else {
    const probe = await probeVideo(sourcePath);
    ({ width, height } = probe);
    posterInput = path.join(outBase, "frame0.png");
    await produce(posterInput, (tmp) => ffmpeg(["-i", sourcePath, "-frames:v", "1", tmp]));

    const previewKey = `${base}/preview.mp4`;
    await produce(path.join(OUT_DIR, previewKey), (tmp) =>
      ffmpeg([
        ...["-i", sourcePath, "-t", String(PREVIEW_SECONDS)],
        ...["-vf", scaleShortSide(width, height, PREVIEW_SHORT_SIDE)],
        ...["-c:v", "libx264", "-preset", "slow", "-crf", "28", "-profile:v", "high"],
        // CRF keeps simple clips small; the cap keeps busy ones inside the preview budget.
        ...["-maxrate", PREVIEW_MAXRATE, "-bufsize", PREVIEW_BUFSIZE],
        ...["-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart", tmp],
      ]),
    );

    const videoKey = `${base}/full.mp4`;
    await produce(path.join(OUT_DIR, videoKey), (tmp) =>
      ffmpeg([
        ...["-i", sourcePath, "-map", "0:v:0", ...(probe.hasAudio ? ["-map", "0:a:0"] : [])],
        ...["-vf", scaleShortSide(width, height, FULL_SHORT_SIDE)],
        ...["-c:v", "libx264", "-preset", "slow", "-crf", "23", "-profile:v", "high"],
        ...["-pix_fmt", "yuv420p", ...(probe.hasAudio ? ["-c:a", "aac", "-b:a", "128k"] : ["-an"])],
        ...["-movflags", "+faststart", tmp],
      ]),
    );

    keys.push(previewKey, videoKey);
    videoFields = { previewKey, videoKey, durationSec: probe.durationSec };
  }

  for (const posterWidth of posterWidths(width)) {
    for (const format of POSTER_FORMATS) {
      const key = posterFileKey(base, posterWidth, format);
      await produce(path.join(OUT_DIR, key), (tmp) => {
        const resized = sharp(posterInput).rotate().resize({ width: posterWidth });
        const encoded =
          format === "avif"
            ? resized.avif({ quality: 50, effort: 4 })
            : resized.webp({ quality: 75, effort: 4 });
        return encoded.toFile(tmp);
      });
      keys.push(key);
    }
  }

  const ogKey = ogImageKey(base);
  await produce(path.join(OUT_DIR, ogKey), (tmp) =>
    sharp(posterInput)
      .rotate()
      .resize({ width: Math.min(OG_IMAGE_WIDTH, width) })
      .jpeg({ quality: 80, mozjpeg: true })
      .toFile(tmp),
  );
  keys.push(ogKey);

  const { data, info } = await sharp(posterInput)
    .rotate()
    .resize(100, 100, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const thumbhash = Buffer.from(rgbaToThumbHash(info.width, info.height, data)).toString("base64");

  const item: MediaItem = {
    id,
    kind: source.kind,
    width,
    height,
    thumbhash,
    posterKey: base,
    ...videoFields,
    prompt: source.prompt,
    model: source.model,
    modelSlug: source.modelSlug,
    createdAt: source.createdAt,
  };
  return { item, keys };
}

async function loadSources(files: string[]): Promise<{ source: SourceItem; dir: string }[]> {
  const lists = await Promise.all(
    files.map(async (file) => {
      const sources = sourcesSchema.parse(JSON.parse(await readFile(file, "utf8")));
      return sources.map((source) => ({ source, dir: path.dirname(file) }));
    }),
  );
  return lists.flat();
}

async function report(built: BuiltItem[]): Promise<void> {
  const totals = new Map<string, { count: number; bytes: number }>();
  const previews: { key: string; bytes: number }[] = [];
  for (const { keys } of built) {
    for (const key of keys) {
      const { size } = await stat(path.join(OUT_DIR, key));
      const ext = path.extname(key);
      const total = totals.get(ext) ?? { count: 0, bytes: 0 };
      totals.set(ext, { count: total.count + 1, bytes: total.bytes + size });
      if (key.endsWith("/preview.mp4")) previews.push({ key, bytes: size });
    }
  }
  const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;
  for (const [ext, { count, bytes }] of totals) {
    console.log(`  ${ext.padEnd(6)} ${String(count).padStart(5)} files  ${mb(bytes).padStart(9)}  avg ${kb(bytes / count)}`);
  }
  if (previews.length > 0) {
    const sizes = previews.map((preview) => preview.bytes).sort((a, b) => a - b);
    const median = sizes[Math.floor(sizes.length / 2)];
    console.log(`  previews: median ${kb(median)}, max ${kb(sizes[sizes.length - 1])}`);
    for (const preview of previews.filter((p) => p.bytes > PREVIEW_BUDGET_BYTES)) {
      console.warn(`  over the ${kb(PREVIEW_BUDGET_BYTES)} preview budget: ${preview.key} (${kb(preview.bytes)})`);
    }
  }
}

const r2EnvSchema = z.object({
  R2_ACCOUNT_ID: z.string().min(1),
  R2_ACCESS_KEY_ID: z.string().min(1),
  R2_SECRET_ACCESS_KEY: z.string().min(1),
  R2_BUCKET: z.string().min(1),
});

async function upload(keys: string[]): Promise<void> {
  process.loadEnvFile(".env.local");
  const parsed = r2EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Fill these in .env.local first: ${missing}`);
  }
  const env = parsed.data;
  const client = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });
  const endpoint = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET}`;

  // Keys we know are on R2 already. Skipping them costs no requests at all.
  const ledgerPath = path.join(OUT_DIR, `.r2-${env.R2_BUCKET}.txt`);
  const known = new Set(
    existsSync(ledgerPath) ? (await readFile(ledgerPath, "utf8")).split("\n").filter(Boolean) : [],
  );
  const pending = keys.filter((key) => !known.has(key));

  // Free-tier guard: stop before sending anything if this would use too much.
  let totalBytes = 0;
  for (const key of keys) totalBytes += (await stat(path.join(OUT_DIR, key))).size;
  const storageShare = totalBytes / R2_FREE_TIER.storageBytes;
  const writeShare = pending.length / R2_FREE_TIER.classA;
  console.log(
    `R2: ${keys.length} files, ${(totalBytes / 1e9).toFixed(2)} GB stored (${percent(storageShare)} of the free 10 GB); ` +
      `this run sends at most ${pending.length} writes (${percent(writeShare)} of the free 1M a month) ` +
      `and ${pending.length} reads.`,
  );
  if (storageShare > GUARD_SHARE) {
    throw new Error(`Stopped: that is over ${percent(GUARD_SHARE)} of R2's free storage.`);
  }
  if (writeShare > RUN_WRITE_SHARE) {
    throw new Error(`Stopped: one run may use at most ${percent(RUN_WRITE_SHARE)} of R2's free writes.`);
  }

  let uploaded = 0;
  let alreadyThere = 0;
  await mapConcurrent(pending, UPLOAD_CONCURRENCY, async (key) => {
    const url = `${endpoint}/${key}`;
    const head = await withNetworkRetry(() => client.fetch(url, { method: "HEAD" }));
    if (head.ok) {
      alreadyThere++;
    } else if (head.status === 404) {
      const body = await readFile(path.join(OUT_DIR, key));
      const put = await withNetworkRetry(() =>
        client.fetch(url, {
          method: "PUT",
          body,
          headers: {
            "Content-Type": CONTENT_TYPES[path.extname(key)] ?? "application/octet-stream",
            "Cache-Control": CACHE_CONTROL,
          },
        }),
      );
      if (!put.ok) throw new Error(`Uploading ${key} failed: HTTP ${put.status} ${await put.text()}`);
      if (++uploaded % 250 === 0) console.log(`  uploaded ${uploaded} …`);
    } else {
      throw new Error(`Checking ${key} failed: HTTP ${head.status}`);
    }
    await appendFile(ledgerPath, `${key}\n`);
  });
  console.log(
    `Uploaded ${uploaded} files; ${alreadyThere} were already on R2; ` +
      `${keys.length - pending.length} skipped without a request.`,
  );
}

function percent(share: number): string {
  return `${(share * 100).toFixed(1)} %`;
}

/**
 * Retries requests that fail before any HTTP response (a DNS hiccup, a dropped connection).
 * aws4fetch already retries 429 and 5xx responses itself.
 */
async function withNetworkRetry<T>(request: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await request();
    } catch (error) {
      if (attempt >= NETWORK_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)));
    }
  }
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
      sources: { type: "string", multiple: true },
    },
  });
  const entries = await loadSources(values.sources ?? [DEFAULT_SOURCES]);

  console.log(`Building ${entries.length} items into ${OUT_DIR}/ …`);
  let done = 0;
  const built = await mapConcurrent(entries, Math.max(2, Math.floor(availableParallelism() / 2)), async ({ source, dir }) => {
    const result = await buildItem(source, dir);
    if (++done % 50 === 0) console.log(`  ${done} / ${entries.length}`);
    return result;
  });

  const manifest = manifestSchema.parse(built.map(({ item }) => item).sort(compareItems));
  await mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
  await writeFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${manifest.length} items to ${MANIFEST_PATH}`);
  await report(built);

  if (values["dry-run"]) {
    console.log("Dry run: nothing uploaded.");
    return;
  }
  await upload(built.flatMap(({ keys }) => keys));
}

await main();
