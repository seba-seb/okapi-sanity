// Rebuilds the "home" page from the freshly-generated, schema-valid
// sanity/seed.ndjson — replacing the published document and dropping any
// errored draft, so the Studio/preview show the clean version with no
// "unknown field" / type-mismatch errors.
//
//   node scripts/generate-seed.mjs      # regenerate seed.ndjson first (if edited)
//   node scripts/rebuild-home.mjs       # apply it
//
// Destructive: this overwrites the existing "home" content.
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
    const val = m[2].replace(/^["']|["']$/g, "");
    if (!(m[1] in process.env)) process.env[m[1]] = val;
  }
} catch {
  // rely on the ambient environment
}

const projectId = process.env.PUBLIC_SANITY_PROJECT_ID;
const dataset = process.env.PUBLIC_SANITY_DATASET;
const apiVersion = process.env.PUBLIC_SANITY_API_VERSION || "2024-10-01";
const token = process.env.SANITY_API_READ_TOKEN;

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
});

const raw = readFileSync(join(__dirname, "..", "sanity", "seed.ndjson"), "utf8");
const page = JSON.parse(raw.trim().split("\n")[0]);

// Replace the published doc with the clean content, then remove any draft so
// the errored version can't shadow it in the editor.
await client.createOrReplace(page);
await client.delete(`drafts.${page._id}`).catch(() => {});

console.log(
  `✓ Rebuilt "${page._id}" (${page.sections.length} sections) and cleared its draft.`,
);
