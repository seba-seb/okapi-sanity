// One-off migration: unset the removed `containerWidth` field from every
// section on every page (published + drafts). Sanity flags stored fields that
// no longer exist in the schema as "Unknown field"; this clears them.
//
//   node scripts/remove-container-width.mjs          # apply
//   node scripts/remove-container-width.mjs --dry     # report only, no writes
//
// Safe to re-run — it only touches sections that still carry the field.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@sanity/client";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Minimal .env.local loader (no dotenv dependency).
try {
  const envPath = join(__dirname, "..", ".env.local");
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    const key = m[1];
    const val = m[2].replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = val;
  }
} catch {
  // no .env.local — rely on the ambient environment
}

const projectId = process.env.PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.PUBLIC_SANITY_DATASET;
const apiVersion = process.env.PUBLIC_SANITY_API_VERSION || "2024-10-01";
const token = process.env.SANITY_API_READ_TOKEN;
const dryRun = process.argv.includes("--dry");

if (!projectId || !dataset || !token) {
  console.error(
    "Missing PUBLIC_SANITY_PROJECT_ID / PUBLIC_SANITY_DATASET / SANITY_API_READ_TOKEN",
  );
  process.exit(1);
}

const client = createClient({
  projectId,
  dataset,
  apiVersion,
  token,
  useCdn: false,
  perspective: "raw", // include drafts (drafts.*) alongside published docs
});

// Every page's section keys. We unset containerWidth on *all* of them rather
// than filtering: a stored `null` still trips the Unknown-field warning, and
// GROQ's defined() can't tell a `null` value from an absent field. Unset is a
// no-op where the field is already gone, so over-unsetting is harmless.
const pages = await client.fetch(
  `*[_type == "page" && count(sections) > 0]{
     _id,
     "keys": sections[]._key
   }`,
);

if (pages.length === 0) {
  console.log("✓ No pages with sections — nothing to do.");
  process.exit(0);
}

let patched = 0;
let sections = 0;
for (const page of pages) {
  const keys = (page.keys ?? []).filter(Boolean);
  if (keys.length === 0) continue;
  const paths = keys.map((k) => `sections[_key=="${k}"].containerWidth`);
  sections += paths.length;

  if (dryRun) {
    console.log(`would unset ${paths.length} on ${page._id}`);
    continue;
  }

  await client.patch(page._id).unset(paths).commit({ visibility: "async" });
  patched++;
  console.log(`unset containerWidth · ${page._id} (${paths.length} section(s))`);
}

console.log(
  dryRun
    ? `\nDry run: ${sections} section(s) across ${pages.length} document(s) would be cleaned.`
    : `\n✓ Done — cleaned ${sections} section(s) across ${patched} document(s).`,
);
