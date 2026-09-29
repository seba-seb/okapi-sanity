// One-off migration: the Button Group `gap` changed from a px number to a
// spacing-scale string ("none" | "xs" … "3xl"). Sanity flags stored numbers as
// 'Expected type "String", got "Number"'. This converts every buttonWrapper's
// numeric gap to the nearest scale token, wherever it's nested (section content,
// grids, sliders, cards, containers), on published + drafts.
//
//   node scripts/migrate-button-gap.mjs          # apply
//   node scripts/migrate-button-gap.mjs --dry     # report only, no writes
//
// Safe to re-run — it only touches gaps still stored as numbers.
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

// px → nearest spacing token (matches --space-* in globals.css). Ties round up.
const SCALE = [
  ["none", 0],
  ["xs", 8],
  ["sm", 16],
  ["md", 24],
  ["lg", 40],
  ["xl", 64],
  ["2xl", 96],
  ["3xl", 144],
];
function gapToken(pxValue) {
  let best = SCALE[0];
  let bestDist = Infinity;
  for (const [name, val] of SCALE) {
    const dist = Math.abs(pxValue - val);
    if (dist < bestDist || (dist === bestDist && val > best[1])) {
      best = [name, val];
      bestDist = dist;
    }
  }
  return best[0];
}

// Walk the doc tree, collecting `{ path, token }` for every buttonWrapper whose
// gap is still a number. `path` is the GROQ path to that gap field.
function collectGapPatches(node, path, out) {
  if (Array.isArray(node)) {
    for (const item of node) {
      if (item && typeof item === "object" && item._key) {
        collectGapPatches(item, `${path}[_key=="${item._key}"]`, out);
      }
    }
    return;
  }
  if (node && typeof node === "object") {
    if (node._type === "buttonWrapper" && typeof node.gap === "number") {
      out.push({ path: `${path}.gap`, token: gapToken(node.gap), from: node.gap });
    }
    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith("_")) continue;
      if (value && typeof value === "object") {
        collectGapPatches(value, path ? `${path}.${key}` : key, out);
      }
    }
  }
}

const pages = await client.fetch(`*[_type == "page"]`);

let touchedDocs = 0;
let touchedGroups = 0;
for (const page of pages) {
  const patches = [];
  collectGapPatches(page, "", patches);
  if (patches.length === 0) continue;
  touchedGroups += patches.length;

  const setPayload = Object.fromEntries(patches.map((p) => [p.path, p.token]));
  const summary = patches
    .map((p) => `${p.from}px→${p.token}`)
    .join(", ");

  if (dryRun) {
    console.log(`would set ${patches.length} on ${page._id}: ${summary}`);
    continue;
  }

  await client.patch(page._id).set(setPayload).commit({ visibility: "async" });
  touchedDocs++;
  console.log(`fixed ${patches.length} group(s) · ${page._id}: ${summary}`);
}

console.log(
  dryRun
    ? `\nDry run: ${touchedGroups} button group(s) across ${pages.length} document(s) would be converted.`
    : `\n✓ Done — converted ${touchedGroups} button group(s) across ${touchedDocs} document(s).`,
);
