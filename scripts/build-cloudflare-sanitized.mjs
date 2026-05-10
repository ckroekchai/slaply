import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tempRoot = path.join(tmpdir(), "slaply-cloudflare-build");

const secretEnvNames = [
  "NEXT_PUBLIC_SITE_URL",
  "SCAN_PRICE_THB",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_STORAGE_BUCKET",
  "MOCK_AI_SCAN",
  "OPENAI_API_KEY",
  "OPENAI_VISION_MODEL",
  "PAYMENT_GATEWAY",
  "PROMPTPAY_ACCOUNT_NAME",
  "REPORT_FROM_EMAIL",
  "ADMIN_UNLOCK_TOKEN"
];

const excludedNames = new Set([
  ".git",
  ".next",
  ".open-next",
  ".wrangler",
  "node_modules"
]);

function shouldExclude(name) {
  return excludedNames.has(name) || (name.startsWith(".env") && name !== ".env.example");
}

function copyWorkspace() {
  rmSync(tempRoot, { recursive: true, force: true });
  mkdirSync(tempRoot, { recursive: true });

  for (const name of readdirSync(repoRoot)) {
    if (shouldExclude(name)) continue;

    cpSync(path.join(repoRoot, name), path.join(tempRoot, name), {
      recursive: true,
      verbatimSymlinks: true
    });
  }

  cpSync(path.join(repoRoot, "node_modules"), path.join(tempRoot, "node_modules"), {
    recursive: true,
    verbatimSymlinks: true
  });
}

function runBuild() {
  const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1" };
  for (const name of secretEnvNames) {
    delete env[name];
  }

  const result = spawnSync("npm", ["run", "build:cloudflare:direct"], {
    cwd: tempRoot,
    env,
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function verifyNoSecretLikeOutput() {
  const openNextDir = path.join(tempRoot, ".open-next");
  const files = [];

  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  }

  walk(openNextDir);

  const riskyPatterns = [
    /sk-[A-Za-z0-9_-]{35,}/,
    /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/
  ];

  for (const file of files) {
    const text = readFileSync(file, "utf8");
    if (riskyPatterns.some((pattern) => pattern.test(text))) {
      throw new Error(`Cloudflare build output contains a secret-like value: ${path.relative(tempRoot, file)}`);
    }
  }
}

function publishOutput() {
  rmSync(path.join(repoRoot, ".open-next"), { recursive: true, force: true });
  cpSync(path.join(tempRoot, ".open-next"), path.join(repoRoot, ".open-next"), {
    recursive: true
  });
}

copyWorkspace();
runBuild();
verifyNoSecretLikeOutput();
publishOutput();

if (!process.env.KEEP_SLAPLY_CLOUDFLARE_BUILD) {
  rmSync(tempRoot, { recursive: true, force: true });
}
