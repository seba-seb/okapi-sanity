// One-off migration for the reworked Image block:
//  - radius: number (px) → "none" | "main"
//  - maxWidth: removed  → unset
// Patches every imageBlock in the home page (published + draft) in place.
//
//   node scripts/migrate-image-fields.mjs
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@sanity/client";

const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  for (const line of readFileSync(join(__dirname, "..", ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    if (!(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  // ambient env
}

const client = createClient({
  projectId: process.env.PUBLIC_SANITY_PROJECT_ID,
  dataset: process.env.PUBLIC_SANITY_DATASET,
  apiVersion: process.env.PUBLIC_SANITY_API_VERSION || "2024-10-01",
  token: process.env.SANITY_API_READ_TOKEN,
  useCdn: false,
  perspective: "raw",
});

/** Yields { path, node } for every imageBlock, building its GROQ path. */
function* findImageBlocks(node, path) {
  if (Array.isArray(node)) {
    for (const item of node) {
      if (item && typeof item === "object" && item._key) {
        yield* findImageBlocks(item, `${path}[_key=="${item._key}"]`);
      }
    }
  } else if (node && typeof node === "object") {
    if (node._type === "imageBlock") yield { path, node };
    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith("_") || value === null) continue;
      if (Array.isArray(value) || typeof value === "object") {
        yield* findImageBlocks(value, path ? `${path}.${key}` : key);
      }
    }
  }
}

const docs = await client.fetch(`*[_id in ["home", "drafts.home"]]`);
let patched = 0;
for (const doc of docs) {
  for (const { path, node } of findImageBlocks(doc, "")) {
    const patch = client.patch(doc._id);
    const unset = [];
    if (typeof node.radius === "number") {
      patch.set({ [`${path}.radius`]: node.radius > 0 ? "main" : "none" });
    } else if (typeof node.radius !== "string") {
      unset.push(`${path}.radius`); // leave the schema default to apply
    }
    if ("maxWidth" in node) unset.push(`${path}.maxWidth`);
    if (unset.length) patch.unset(unset);
    await patch.commit({ visibility: "async" });
    patched++;
    console.log(`patched imageBlock · ${doc._id} · ${path}`);
  }
}
console.log(patched ? `\n✓ Migrated ${patched} image block(s).` : "✓ No image blocks to migrate.");
