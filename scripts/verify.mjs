#!/usr/bin/env node
/**
 * The checks that catch what breaks silently — after a Sanity upgrade, a core
 * change, or a misconfigured deploy. Adapter-agnostic.
 *
 *   npm run verify                         build + static-output checks
 *   npm run verify -- http://localhost:4321   …plus HTTP checks against a
 *                                          running server (dev or a deploy)
 */
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const baseUrl = process.argv[2];
let failed = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => {
  failed++;
  console.log(`  ✗ ${msg}`);
};
const check = (cond, msg) => (cond ? ok(msg) : fail(msg));

console.log("\n1. Unit checks");
execSync("node --experimental-strip-types --no-warnings src/core/lib/routes.check.ts", { stdio: "inherit" });
execSync("node --experimental-strip-types --no-warnings src/core/canvas/channels.check.ts", { stdio: "inherit" });
// Every block field gets a control in the Remarkable Editor panel.
execSync("npx sanity exec scripts/check-editor-schema.ts", { stdio: ["ignore", "inherit", "inherit"] });
// Structural edits (insert/move/remove/duplicate) keep the document valid.
execSync("npx sanity exec src/core/editor/ops.check.ts", { stdio: ["ignore", "inherit", "inherit"] });

console.log("\n2. Build");
execSync("npx astro build", { stdio: ["ignore", "ignore", "inherit"] });
ok("astro build");

// Static output location depends on the adapter.
const outDir = [".vercel/output/static", "dist/client", ".netlify/static", "dist"].find((d) =>
  existsSync(join(d, "index.html")),
);
if (!outDir) {
  fail("no index.html found in the static output");
  process.exit(1);
}
const htmlFiles = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (name.endsWith(".html")) htmlFiles.push(p);
  }
})(outDir);
const publicHtml = htmlFiles.filter((f) => !f.includes(`${outDir}/studio/`));

console.log(`\n3. Static output (${outDir}, ${publicHtml.length} public pages)`);
check(!htmlFiles.some((f) => f.includes("/preview/")), "/preview is not prerendered (it must render on demand)");
const leaks = publicHtml.filter((f) => /PreviewTools|studio-component/.test(readFileSync(f, "utf8")));
check(leaks.length === 0, `no editor/Studio bundle in public HTML${leaks.length ? `: ${leaks.join(", ")}` : ""}`);
const home = readFileSync(join(outDir, "index.html"), "utf8");
check(!home.includes("Your visual page builder is ready"), "home rendered real content (not <Welcome>) — env + dataset OK");
check(/<link rel="canonical" href="https?:\/\/[^"]+"/.test(home), "home has an absolute canonical");
check(existsSync(join(outDir, "sitemap.xml")) && existsSync(join(outDir, "robots.txt")), "sitemap.xml + robots.txt built");

if (baseUrl) {
  console.log(`\n4. HTTP (${baseUrl})`);
  const status = async (path, init) => (await fetch(new URL(path, baseUrl), { redirect: "manual", ...init })).status;
  check((await status("/")) === 200, "/ → 200");
  check((await status("/preview")) === 401, "/preview without cookie → 401");
  check((await status("/preview", { headers: { cookie: "__remarkable_draft=forged" } })) === 401, "/preview with a forged cookie → 401");
  check(
    (await status("/api/draft-mode/enable?sanity-preview-secret=nope&sanity-preview-pathname=/preview")) === 401,
    "enable with a fake secret → 401",
  );
  check((await status("/studio")) === 200, "/studio → 200");
}

console.log(failed ? `\n${failed} check(s) failed.\n` : "\nAll checks passed.\n");
process.exit(failed ? 1 : 0);
