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
import { gzipSync } from "node:zlib";

const baseUrl = process.argv[2];
let failed = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => {
  failed++;
  console.log(`  ✗ ${msg}`);
};
const check = (cond, msg) => (cond ? ok(msg) : fail(msg));

console.log("\n1. Unit checks");
// Sanity is pinned because patches/ only fit one exact version.
const sanityVersion = JSON.parse(readFileSync("node_modules/sanity/package.json", "utf8")).version;
check(existsSync(`patches/sanity+${sanityVersion}.patch`), `installed sanity@${sanityVersion} has its patch (patches/README.md)`);
execSync("node --experimental-strip-types --no-warnings src/core/lib/routes.check.ts", { stdio: "inherit" });
// Every block field gets a control in the Okapi Editor panel.
execSync("npx sanity exec scripts/check-editor-schema.ts", { stdio: ["ignore", "inherit", "inherit"] });
// Structural edits (insert/move/remove/duplicate) keep the document valid.
execSync("npx sanity exec src/core/editor/ops.check.ts", { stdio: ["ignore", "inherit", "inherit"] });
// Style tokens → per-block CSS (breakpoints, specificity, no selector injection).
execSync("npx sanity exec src/core/style/stylesheet.check.ts", { stdio: ["ignore", "inherit", "inherit"] });
// Component instance overrides apply to the right block and never touch the master.
execSync("npx sanity exec src/core/render/overrides.check.ts", { stdio: ["ignore", "inherit", "inherit"] });
// AI chat: role permissions (okapi.policy.ts) gate every change the model proposes.
execSync("npx sanity exec src/core/editor/chat.check.ts", { stdio: ["ignore", "inherit", "inherit"] });

console.log("\n2. Build");
execSync("npx astro build", { stdio: ["ignore", "ignore", "inherit"] });
ok("astro build");

// Static output location (dist/ with no adapter; kept flexible if one is added).
const outDir = ["dist", "dist/client", ".vercel/output/static", ".netlify/static"].find((d) =>
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
const sitePages = publicHtml.filter((f) => !f.includes("edit-canvas"));
const leaks = sitePages.filter((f) => /EditorTool|CanvasApp|studio-component/.test(readFileSync(f, "utf8")));
check(leaks.length === 0, `no editor/Studio bundle in public HTML${leaks.length ? `: ${leaks.join(", ")}` : ""}`);

// The JS a public page can load: entry scripts, their dynamic imports (the
// island hydrator, counted as if the page has islands) and every static import.
// Per-block lazy chunks (three.js for logo3d) load only with that block: not counted.
function jsGraph(html) {
  const seen = new Set();
  const visit = (f, entry) => {
    if (seen.has(f) || !existsSync(join(outDir, f))) return;
    seen.add(f);
    const src = readFileSync(join(outDir, f), "utf8");
    for (const m of src.matchAll(/(?:from|import)\s*["'](\.\/[^"']+\.js)["']/g)) visit(join(f, "..", m[1]));
    if (entry) for (const m of src.matchAll(/import\(\s*["'`](\.\/[^"'`]+\.js)["'`]/g)) visit(join(f, "..", m[1]));
  };
  for (const m of html.matchAll(/\/_astro\/[^"]+?\.js/g)) visit(m[0], true);
  return [...seen];
}
// The page we measure: the home if Okapi renders it, else the first page
// it renders (in a project where Okapi serves only some routes).
const isOkapi = (f) => /data-sanity-path=/.test(readFileSync(f, "utf8"));
const index = join(outDir, "index.html");
const pageFile = isOkapi(index) ? index : sitePages.find(isOkapi);
check(!!pageFile, `Okapi rendered a page (${pageFile ? pageFile.slice(outDir.length) : "none — env, dataset or routes?"})`);
if (pageFile) {
  const html = readFileSync(pageFile, "utf8");
  const graph = jsGraph(html);
  const gzKB = Math.round(graph.reduce((n, f) => n + gzipSync(readFileSync(join(outDir, f))).length, 0) / 1024);
  const editorLeak = graph.filter((f) => /comlink|xstate/.test(readFileSync(join(outDir, f), "utf8")));
  check(editorLeak.length === 0, `public pages load no visual-editing runtime (comlink/xstate)${editorLeak.length ? `: ${editorLeak.join(", ")}` : ""}`);
  check(gzKB < 250, `page JS ≤ 250 KB gzip (${gzKB} KB, ${graph.length} files)`);
  check(/<link rel="canonical" href="https?:\/\/[^"]+"/.test(html), "page has an absolute canonical");
}
const home = readFileSync(index, "utf8");
check(!home.includes("Your visual page builder is ready"), "home is not the <Welcome> setup screen — env + dataset OK");
check(["sitemap.xml", "sitemap-index.xml"].some((f) => existsSync(join(outDir, f))) && existsSync(join(outDir, "robots.txt")), "sitemap + robots.txt built");

if (baseUrl) {
  console.log(`\n4. HTTP (${baseUrl})`);
  const status = async (path, init) => (await fetch(new URL(path, baseUrl), { redirect: "manual", ...init })).status;
  check((await status("/")) === 200, "/ → 200");
  check((await status("/studio")) === 200, "/studio → 200");
  check((await status("/edit-canvas")) === 200, "/edit-canvas → 200");
}

console.log(failed ? `\n${failed} check(s) failed.\n` : "\nAll checks passed.\n");
process.exit(failed ? 1 : 0);
