// Shows this month's Cloudflare R2 usage against the free tier, for the whole account, and
// exits with an error at 80 % of any limit, so the daily GitHub Action emails a warning in time.
// Storage is the current size of every bucket, a slightly strict stand-in for R2's GB-month.
//
// Needs CLOUDFLARE_API_TOKEN (permission: Account › Account Analytics › Read) and
// R2_ACCOUNT_ID, from .env.local or the environment.
//
// Usage: pnpm r2:usage
import { existsSync } from "node:fs";
import { z } from "zod";
import { FAIL_SHARE, R2_FREE_TIER, WARN_SHARE, operationClass } from "./r2-limits.ts";

const QUERY = `query R2Usage($accountTag: string!, $start: Time!, $end: Time!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      operations: r2OperationsAdaptiveGroups(
        limit: 10000
        filter: { datetime_geq: $start, datetime_leq: $end }
      ) {
        sum { requests }
        dimensions { actionType }
      }
      storage: r2StorageAdaptiveGroups(
        limit: 10000
        filter: { datetime_geq: $start, datetime_leq: $end }
        orderBy: [datetime_DESC]
      ) {
        max { payloadSize metadataSize objectCount }
        dimensions { bucketName datetime }
      }
    }
  }
}`;

const responseSchema = z.object({
  data: z
    .object({
      viewer: z.object({
        accounts: z.array(
          z.object({
            operations: z.array(
              z.object({
                sum: z.object({ requests: z.number() }),
                dimensions: z.object({ actionType: z.string() }),
              }),
            ),
            storage: z.array(
              z.object({
                max: z.object({ payloadSize: z.number(), metadataSize: z.number(), objectCount: z.number() }),
                dimensions: z.object({ bucketName: z.string(), datetime: z.string() }),
              }),
            ),
          }),
        ),
      }),
    })
    .nullable(),
  errors: z.array(z.object({ message: z.string() })).nullish(),
});

const envSchema = z.object({
  CLOUDFLARE_API_TOKEN: z.string().min(1),
  R2_ACCOUNT_ID: z.string().min(1),
});

async function main(): Promise<void> {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const parsedEnv = envSchema.safeParse(process.env);
  if (!parsedEnv.success) {
    const missing = parsedEnv.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Set ${missing} in .env.local (or as CI secrets) first. See README, "R2 free tier".`);
  }
  const env = parsedEnv.data;

  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const response = await fetch("https://api.cloudflare.com/client/v4/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: QUERY,
      variables: { accountTag: env.R2_ACCOUNT_ID, start: start.toISOString(), end: now.toISOString() },
    }),
  });
  if (!response.ok) throw new Error(`Cloudflare analytics API: HTTP ${response.status}`);
  const body = responseSchema.parse(await response.json());
  if (body.errors?.length || !body.data) {
    throw new Error(`Cloudflare analytics API: ${body.errors?.map((e) => e.message).join("; ") ?? "no data"}`);
  }
  const account = body.data.viewer.accounts[0];
  if (account === undefined) throw new Error("Cloudflare analytics API: account not found");

  let classA = 0;
  let classB = 0;
  for (const { sum, dimensions } of account.operations) {
    const kind = operationClass(dimensions.actionType);
    if (kind === "A") classA += sum.requests;
    if (kind === "B") classB += sum.requests;
  }

  // Rows are newest first; the first row per bucket is its current size.
  const latestPerBucket = new Map<string, number>();
  for (const { max, dimensions } of account.storage) {
    if (!latestPerBucket.has(dimensions.bucketName)) {
      latestPerBucket.set(dimensions.bucketName, max.payloadSize + max.metadataSize);
    }
  }
  const storageBytes = [...latestPerBucket.values()].reduce((sum, bytes) => sum + bytes, 0);

  const month = start.toLocaleString("en", { month: "long", year: "numeric", timeZone: "UTC" });
  console.log(`R2 usage for ${month} (whole account), free tier limits:`);
  const rows = [
    { label: "Storage", used: storageBytes, limit: R2_FREE_TIER.storageBytes, show: gigabytes },
    { label: "Class A (writes, lists)", used: classA, limit: R2_FREE_TIER.classA, show: count },
    { label: "Class B (reads)", used: classB, limit: R2_FREE_TIER.classB, show: count },
  ];
  let worst = 0;
  for (const { label, used, limit, show } of rows) {
    const share = used / limit;
    worst = Math.max(worst, share);
    const status = share >= FAIL_SHARE ? "OVER 80 %" : share >= WARN_SHARE ? "over 50 %" : "ok";
    console.log(`  ${label.padEnd(24)} ${show(used).padStart(12)} of ${show(limit).padEnd(10)} ${(share * 100).toFixed(1).padStart(5)} %  ${status}`);
    if (process.env.GITHUB_ACTIONS === "true" && share >= WARN_SHARE) {
      const level = share >= FAIL_SHARE ? "error" : "warning";
      console.log(`::${level}::R2 ${label} is at ${(share * 100).toFixed(1)} % of the free tier`);
    }
  }
  if (worst >= FAIL_SHARE) process.exitCode = 1;
}

function gigabytes(bytes: number): string {
  return `${(bytes / 1e9).toFixed(2)} GB`;
}

function count(value: number): string {
  return value.toLocaleString("en");
}

await main();
