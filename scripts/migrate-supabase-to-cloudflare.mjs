import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultOutDir = path.join(repoRoot, ".migration", "cloudflare");
const sourceBucket = process.env.SUPABASE_STORAGE_BUCKET || "packaging-uploads";

const tableColumns = {
  customers: ["id", "created_at", "email", "name", "business_name", "country"],
  scans: [
    "id",
    "created_at",
    "customer_id",
    "customer_email",
    "image_url",
    "image_storage_path",
    "product_category",
    "sales_channel",
    "target_customer",
    "price_tier",
    "main_concern",
    "launch_stage",
    "language",
    "scan_status",
    "payment_status",
    "ai_model",
    "ai_raw_output",
    "ai_validated_output",
    "overall_score",
    "readiness_level",
    "report_url",
    "error_message"
  ],
  payments: [
    "id",
    "created_at",
    "scan_id",
    "customer_email",
    "provider",
    "provider_payment_id",
    "amount",
    "currency",
    "payment_status",
    "paid_at",
    "fee_amount",
    "refund_status",
    "raw_event"
  ],
  events: ["id", "created_at", "scan_id", "customer_email", "event_name", "event_data"]
};

function parseArgs(argv) {
  return argv.reduce(
    (acc, arg) => {
      if (arg === "--apply-db") acc.applyDb = true;
      else if (arg === "--copy-storage") acc.copyStorage = true;
      else if (arg === "--skip-db") acc.skipDb = true;
      else if (arg === "--skip-storage") acc.skipStorage = true;
      else if (arg.startsWith("--database=")) acc.database = arg.slice("--database=".length);
      else if (arg.startsWith("--r2-bucket=")) acc.r2Bucket = arg.slice("--r2-bucket=".length);
      else if (arg.startsWith("--out=")) acc.outDir = path.resolve(arg.slice("--out=".length));
      else if (arg.startsWith("--limit=")) acc.limit = Number(arg.slice("--limit=".length));
      else if (arg === "--help") acc.help = true;
      else acc.unknown.push(arg);
      return acc;
    },
    {
      applyDb: false,
      copyStorage: false,
      skipDb: false,
      skipStorage: false,
      database: "",
      r2Bucket: "",
      outDir: defaultOutDir,
      limit: null,
      help: false,
      unknown: []
    }
  );
}

function printHelp() {
  console.log(`Usage:
  node scripts/migrate-supabase-to-cloudflare.mjs [options]

Options:
  --out=<dir>              Write exported SQL/manifest here. Default: .migration/cloudflare
  --limit=<n>              Export/copy only the newest n scans and related rows for sample testing.
  --apply-db               Apply generated D1 SQL with Wrangler. Requires --database=<name>.
  --database=<name>        D1 database name for --apply-db.
  --copy-storage           Copy exported Supabase storage objects to R2. Requires --r2-bucket=<name>.
  --r2-bucket=<name>       R2 bucket name for --copy-storage.
  --skip-db                Skip database export/apply.
  --skip-storage           Skip storage inventory/copy.

Default behavior is a dry-run export only: no D1 write and no R2 upload.`);
}

function loadEnvFile() {
  const envPath = path.join(repoRoot, ".env.local");
  if (!existsSync(envPath)) return;

  const text = readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key]) continue;

    const value = rawValue
      .replace(/^['"]|['"]$/g, "")
      .replace(/\\n/g, "\n");
    process.env[key] = value;
  }
}

function getSupabaseClient() {
  loadEnvFile();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function fetchAllRows(supabase, table) {
  const pageSize = 1000;
  const rows = [];

  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const { data, error } = await supabase.from(table).select("*").range(from, to);
    if (error) throw new Error(`Could not export ${table}: ${error.message}`);
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }

  return rows;
}

function chooseSampleScanIds(scans, limit) {
  if (!limit || !Number.isFinite(limit) || limit <= 0) return null;

  return new Set(
    scans
      .slice()
      .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
      .slice(0, limit)
      .map((scan) => scan.id)
  );
}

function filterRelatedRows(data, sampleScanIds) {
  if (!sampleScanIds) return data;

  const customerIds = new Set(
    data.scans
      .filter((scan) => sampleScanIds.has(scan.id))
      .map((scan) => scan.customer_id)
      .filter(Boolean)
  );

  return {
    customers: data.customers.filter((row) => customerIds.has(row.id)),
    scans: data.scans.filter((row) => sampleScanIds.has(row.id)),
    payments: data.payments.filter((row) => sampleScanIds.has(row.scan_id)),
    events: data.events.filter((row) => sampleScanIds.has(row.scan_id))
  };
}

function mapScanStatus(status) {
  if (status === "scanning") return "processing";
  if (status === "preview_ready") return "completed";
  return status || "created";
}

function normalizeRow(table, row) {
  const copy = { ...row };

  if (table === "scans") {
    copy.scan_status = mapScanStatus(copy.scan_status);
    if (copy.image_storage_path) {
      copy.image_url = `/api/get-upload?key=${encodeURIComponent(copy.image_storage_path)}`;
    }
  }

  for (const key of ["ai_raw_output", "ai_validated_output", "raw_event", "event_data"]) {
    if (key in copy && copy[key] != null && typeof copy[key] !== "string") {
      copy[key] = JSON.stringify(copy[key]);
    }
  }

  return copy;
}

function sqlValue(value) {
  if (value == null) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function buildInsertSql(table, rows) {
  const columns = tableColumns[table];

  if (!rows.length) return "";

  return rows
    .map((row) => {
      const normalized = normalizeRow(table, row);
      const values = columns.map((column) => sqlValue(normalized[column])).join(", ");
      return `insert or replace into ${table} (${columns.join(", ")}) values (${values});`;
    })
    .join("\n");
}

async function exportDatabase(supabase, options) {
  const rawData = {
    customers: await fetchAllRows(supabase, "customers"),
    scans: await fetchAllRows(supabase, "scans"),
    payments: await fetchAllRows(supabase, "payments"),
    events: await fetchAllRows(supabase, "events")
  };
  const sampleScanIds = chooseSampleScanIds(rawData.scans, options.limit);
  const data = filterRelatedRows(rawData, sampleScanIds);
  const sql = [
    buildInsertSql("customers", data.customers),
    buildInsertSql("scans", data.scans),
    buildInsertSql("payments", data.payments),
    buildInsertSql("events", data.events)
  ]
    .filter(Boolean)
    .join("\n");

  mkdirSync(options.outDir, { recursive: true });
  const sqlPath = path.join(options.outDir, "supabase-to-d1.sql");
  writeFileSync(sqlPath, `${sql}\n`);

  return {
    sqlPath,
    counts: {
      customers: data.customers.length,
      scans: data.scans.length,
      payments: data.payments.length,
      events: data.events.length
    },
    scanIds: data.scans.map((scan) => scan.id)
  };
}

async function listStorageObjects(supabase, prefix = "") {
  const bucket = supabase.storage.from(sourceBucket);
  const objects = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await bucket.list(prefix, {
      limit: pageSize,
      offset,
      sortBy: { column: "name", order: "asc" }
    });

    if (error) throw new Error(`Could not list storage objects at ${prefix || "/"}: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const entry of data) {
      const key = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id) {
        objects.push({
          key,
          size: Number(entry.metadata?.size || 0),
          contentType: entry.metadata?.mimetype || "application/octet-stream"
        });
      } else {
        objects.push(...(await listStorageObjects(supabase, key)));
      }
    }

    if (data.length < pageSize) break;
  }

  return objects;
}

async function exportStorageInventory(supabase, options, scanIds) {
  if (options.skipStorage) return { objects: [], totalBytes: 0 };

  const allObjects = await listStorageObjects(supabase);
  const scanIdSet = scanIds?.length ? new Set(scanIds) : null;
  let objects = scanIdSet ? allObjects.filter((object) => scanIdSet.has(object.key.split("/")[0])) : allObjects;

  if (options.limit && !scanIdSet) {
    objects = objects.slice(0, options.limit);
  }

  const totalBytes = objects.reduce((sum, object) => sum + object.size, 0);
  writeFileSync(path.join(options.outDir, "storage-inventory.json"), JSON.stringify({ bucket: sourceBucket, objects }, null, 2));

  return { objects, totalBytes };
}

function runWrangler(args) {
  const result = spawnSync("npx", ["wrangler", ...args], {
    cwd: repoRoot,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    throw new Error(`Wrangler command failed: wrangler ${args.join(" ")}`);
  }
}

function applyDatabase(options, sqlPath) {
  if (!options.applyDb) return;
  if (!options.database) throw new Error("--database=<name> is required with --apply-db.");

  runWrangler(["d1", "execute", options.database, "--remote", "--file", sqlPath]);
}

async function copyStorageToR2(supabase, options, objects) {
  if (!options.copyStorage) return;
  if (!options.r2Bucket) throw new Error("--r2-bucket=<name> is required with --copy-storage.");

  const tempDir = path.join(tmpdir(), "slaply-supabase-storage-copy");
  rmSync(tempDir, { recursive: true, force: true });
  mkdirSync(tempDir, { recursive: true });

  for (const object of objects) {
    const { data, error } = await supabase.storage.from(sourceBucket).download(object.key);
    if (error || !data) throw new Error(`Could not download ${object.key}: ${error?.message || "missing file"}`);

    const localPath = path.join(tempDir, encodeURIComponent(object.key));
    const buffer = Buffer.from(await data.arrayBuffer());
    writeFileSync(localPath, buffer);

    runWrangler([
      "r2",
      "object",
      "put",
      `${options.r2Bucket}/${object.key}`,
      "--remote",
      "--file",
      localPath,
      "--content-type",
      data.type || object.contentType
    ]);
  }

  rmSync(tempDir, { recursive: true, force: true });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  if (options.unknown.length) {
    throw new Error(`Unknown option(s): ${options.unknown.join(", ")}`);
  }

  const supabase = getSupabaseClient();
  mkdirSync(options.outDir, { recursive: true });

  let dbExport = { sqlPath: "", counts: {}, scanIds: [] };

  if (!options.skipDb) {
    dbExport = await exportDatabase(supabase, options);
    applyDatabase(options, dbExport.sqlPath);
  }

  const storageExport = await exportStorageInventory(supabase, options, dbExport.scanIds);
  await copyStorageToR2(supabase, options, storageExport.objects);

  const manifest = {
    generated_at: new Date().toISOString(),
    mode: {
      apply_db: options.applyDb,
      copy_storage: options.copyStorage,
      limit: options.limit
    },
    database: dbExport.counts,
    storage: {
      source_bucket: sourceBucket,
      object_count: storageExport.objects.length,
      total_bytes: storageExport.totalBytes
    }
  };

  writeFileSync(path.join(options.outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
