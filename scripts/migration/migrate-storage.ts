/**
 * Storage Migration Script — Mechanic Raiz Pro
 *
 * Copies all objects from the OLD Supabase Storage to the NEW project,
 * preserving bucket names, paths, and content-type.
 *
 * Usage:
 *   deno run --allow-env --allow-net --allow-write --allow-read \
 *     scripts/migration/migrate-storage.ts [options]
 *
 * Options:
 *   --dry-run          List what would be copied without copying (default: true)
 *   --bucket <name>    Only migrate this bucket
 *   --resume           Skip objects that already exist in the new project
 *   --concurrency <n>  Max parallel uploads (default: 5)
 *   --inventory-only   Only list objects in OLD project, do not copy
 *
 * Required env vars:
 *   OLD_SUPABASE_URL=https://cuhkkoqqeguascdsvtky.supabase.co
 *   OLD_SERVICE_ROLE_KEY=<old service role key>
 *   NEW_SUPABASE_URL=https://kurlgmngmglhvknwxjee.supabase.co
 *   NEW_SERVICE_ROLE_KEY=<new service role key>
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

// --- Config ---
const OLD_URL = Deno.env.get("OLD_SUPABASE_URL") ?? "";
const OLD_KEY = Deno.env.get("OLD_SERVICE_ROLE_KEY") ?? "";
const NEW_URL = Deno.env.get("NEW_SUPABASE_URL") ?? "";
const NEW_KEY = Deno.env.get("NEW_SERVICE_ROLE_KEY") ?? "";

const args = Deno.args;
const DRY_RUN = !args.includes("--dry-run=false") && !args.includes("--no-dry-run");
const INVENTORY_ONLY = args.includes("--inventory-only");
const RESUME = args.includes("--resume");
const BUCKET_FILTER = (() => {
  const idx = args.indexOf("--bucket");
  return idx !== -1 ? args[idx + 1] : null;
})();
const CONCURRENCY = (() => {
  const idx = args.indexOf("--concurrency");
  return idx !== -1 ? parseInt(args[idx + 1], 10) : 5;
})();

interface StorageObject {
  name: string;
  bucket: string;
  size: number;
  contentType: string;
  lastModified: string;
}

interface MigrationResult {
  bucket: string;
  path: string;
  status: "copied" | "skipped" | "failed" | "dry-run";
  error?: string;
  bytes?: number;
}

async function listObjects(client: SupabaseClient, bucket: string, prefix = ""): Promise<StorageObject[]> {
  const results: StorageObject[] = [];
  const { data, error } = await client.storage.from(bucket).list(prefix, {
    limit: 1000,
    offset: 0,
  });
  if (error) throw new Error(`list ${bucket}/${prefix}: ${error.message}`);
  if (!data) return results;

  for (const item of data) {
    if (item.id === null) {
      // folder — recurse
      const sub = await listObjects(client, bucket, prefix ? `${prefix}/${item.name}` : item.name);
      results.push(...sub);
    } else {
      results.push({
        name: prefix ? `${prefix}/${item.name}` : item.name,
        bucket,
        size: item.metadata?.size ?? 0,
        contentType: item.metadata?.mimetype ?? "application/octet-stream",
        lastModified: item.updated_at ?? item.created_at ?? "",
      });
    }
  }
  return results;
}

async function listBuckets(client: SupabaseClient): Promise<string[]> {
  const { data, error } = await client.storage.listBuckets();
  if (error) throw new Error(`listBuckets: ${error.message}`);
  return (data ?? []).map(b => b.name);
}

async function ensureBucket(client: SupabaseClient, name: string, isPublic: boolean): Promise<void> {
  const { error } = await client.storage.createBucket(name, { public: isPublic });
  if (error && !error.message.includes("already exists")) {
    throw new Error(`createBucket ${name}: ${error.message}`);
  }
}

async function copyObject(
  oldClient: SupabaseClient,
  newClient: SupabaseClient,
  obj: StorageObject,
  skipIfExists: boolean,
): Promise<MigrationResult> {
  if (DRY_RUN) {
    return { bucket: obj.bucket, path: obj.name, status: "dry-run", bytes: obj.size };
  }

  if (skipIfExists) {
    const { data } = await newClient.storage.from(obj.bucket).list(
      obj.name.includes("/") ? obj.name.split("/").slice(0, -1).join("/") : "",
      { search: obj.name.split("/").pop() }
    );
    if (data && data.length > 0) {
      return { bucket: obj.bucket, path: obj.name, status: "skipped" };
    }
  }

  // Download from old
  const { data: blob, error: dlErr } = await oldClient.storage
    .from(obj.bucket)
    .download(obj.name);
  if (dlErr) return { bucket: obj.bucket, path: obj.name, status: "failed", error: dlErr.message };
  if (!blob) return { bucket: obj.bucket, path: obj.name, status: "failed", error: "empty blob" };

  // Upload to new
  const { error: ulErr } = await newClient.storage
    .from(obj.bucket)
    .upload(obj.name, blob, {
      contentType: obj.contentType,
      upsert: false,
    });
  if (ulErr && !ulErr.message.includes("already exists")) {
    return { bucket: obj.bucket, path: obj.name, status: "failed", error: ulErr.message };
  }

  return { bucket: obj.bucket, path: obj.name, status: "copied", bytes: obj.size };
}

async function runWithConcurrency<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = [];
  const queue = [...tasks];
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, async () => {
    while (queue.length) {
      const task = queue.shift()!;
      results.push(await task());
    }
  });
  await Promise.all(workers);
  return results;
}

// --- Main ---
if (!OLD_URL || !OLD_KEY || !NEW_URL || !NEW_KEY) {
  if (!INVENTORY_ONLY || !OLD_URL || !OLD_KEY) {
    console.error("Missing required env vars. See script header.");
    Deno.exit(1);
  }
}

const oldClient = createClient(OLD_URL, OLD_KEY, { auth: { persistSession: false } });
const newClient = NEW_URL && NEW_KEY
  ? createClient(NEW_URL, NEW_KEY, { auth: { persistSession: false } })
  : null;

console.log(`Mode: ${DRY_RUN ? "DRY-RUN" : "LIVE"} | Resume: ${RESUME} | Concurrency: ${CONCURRENCY}`);

const oldBuckets = await listBuckets(oldClient);
const buckets = BUCKET_FILTER ? [BUCKET_FILTER] : oldBuckets;
console.log(`Buckets to process: ${buckets.join(", ")}`);

const manifest: StorageObject[] = [];
const results: MigrationResult[] = [];

for (const bucket of buckets) {
  console.log(`\nScanning bucket: ${bucket}`);
  const objects = await listObjects(oldClient, bucket);
  manifest.push(...objects);
  console.log(`  Found ${objects.length} objects`);

  if (INVENTORY_ONLY) continue;
  if (!newClient) { console.error("NEW_SUPABASE_URL/KEY required for migration"); continue; }

  await ensureBucket(newClient, bucket, true); // adjust public flag per bucket if needed

  const tasks = objects.map(obj => () => copyObject(oldClient, newClient, obj, RESUME));
  const batchResults = await runWithConcurrency(tasks, CONCURRENCY);
  results.push(...batchResults);
}

// Report
const copied  = results.filter(r => r.status === "copied").length;
const skipped = results.filter(r => r.status === "skipped").length;
const failed  = results.filter(r => r.status === "failed").length;
const dryRun  = results.filter(r => r.status === "dry-run").length;
const totalBytes = manifest.reduce((s, o) => s + o.size, 0);

console.log(`\n=== Summary ===`);
console.log(`Total objects in OLD: ${manifest.length} (${(totalBytes / 1024 / 1024).toFixed(1)} MB)`);
if (!INVENTORY_ONLY) {
  console.log(`Copied: ${copied} | Skipped: ${skipped} | Failed: ${failed} | Dry-run: ${dryRun}`);
}

if (failed > 0) {
  console.log("\nFailed objects:");
  results.filter(r => r.status === "failed").forEach(r => {
    console.log(`  ${r.bucket}/${r.path}: ${r.error}`);
  });
}

// Write manifest
const manifestPath = "reports/migration/storage-manifest.json";
await Deno.writeTextFile(manifestPath, JSON.stringify({ buckets, objects: manifest, results }, null, 2));
console.log(`\nManifest written to ${manifestPath}`);
