#!/usr/bin/env node
/**
 * The checks that catch what breaks silently — after a Sanity upgrade, a core
 * change, or a misconfigured deploy. Adapter-agnostic.
 *
 *   npm run verify                         build + static-output checks
 *   npm run verify -- http://localhost:4321   …plus HTTP checks against a
 *                                          running server (dev or a deploy)
 */
import { execSync, spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { gzipSync } from "node:zlib";
import { loadEnv } from "vite";

const baseUrl = process.argv[2];
// Local binaries through the project's own package manager (npx would offer to
// download from npm when a bin is missing).
const pm = ["pnpm-lock.yaml:pnpm exec", "yarn.lock:yarn", "bun.lock:bunx", "bun.lockb:bunx"]
  .map((e) => e.split(":")).find(([f]) => existsSync(f))?.[1] ?? "npx";
let failed = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const fail = (msg) => {
  failed++;
  console.log(`  ✗ ${msg}`);
};
const check = (cond, msg) => (cond ? ok(msg) : fail(msg));
let warned = 0;
const warn = (msg) => {
  warned++;
  console.log(`  ⚠ ${msg}`);
};

/** Slugs of the published pages (null if it can't tell). A fresh install has none until someone publishes. */
async function publishedSlugs() {
  const env = { ...loadEnv("production", process.cwd(), ""), ...process.env };
  const projectId = env.PUBLIC_SANITY_PROJECT_ID;
  if (!projectId) return null;
  const query = encodeURIComponent('*[_type == "page" && defined(slug.current)].slug.current');
  const token = env.SANITY_API_READ_TOKEN;
  try {
    const res = await fetch(
      `https://${projectId}.api.sanity.io/v2024-10-01/data/query/${env.PUBLIC_SANITY_DATASET || "production"}?query=${query}&perspective=published`,
      token ? { headers: { authorization: `Bearer ${token}` } } : {},
    );
    return res.ok ? (await res.json()).result : null;
  } catch {
    return null;
  }
}

console.log("\n1. Unit checks");
execSync(`${pm} sanity exec src/core/lib/routes.check.ts`, { stdio: ["ignore", "inherit", "inherit"] });
// Every block field gets a control in the Okapi Editor panel.
execSync(`${pm} sanity exec scripts/check-editor-schema.ts`, { stdio: ["ignore", "inherit", "inherit"] });
// Structural edits (insert/move/remove/duplicate) keep the document valid.
execSync(`${pm} sanity exec src/core/editor/ops.check.ts`, { stdio: ["ignore", "inherit", "inherit"] });
// Style tokens → per-block CSS (breakpoints, specificity, no selector injection).
execSync(`${pm} sanity exec src/core/style/stylesheet.check.ts`, { stdio: ["ignore", "inherit", "inherit"] });
// Component instance overrides apply to the right block and never touch the master.
execSync(`${pm} sanity exec src/core/render/overrides.check.ts`, { stdio: ["ignore", "inherit", "inherit"] });
// AI chat: role permissions (okapi.policy.ts) gate every change the model proposes.
execSync(`${pm} sanity exec src/core/editor/chat.check.ts`, { stdio: ["ignore", "inherit", "inherit"] });
// Rich text → canvas HTML escapes text and keys (no attribute break-out).
execSync(`${pm} sanity exec src/core/editor/richtext.check.ts`, { stdio: ["ignore", "inherit", "inherit"] });
// Everything Okapi's CSS defines globally starts with ok- (classes, variables,
// Tailwind theme keys, data-ok-* attributes, keyframes), so it can't collide
// with the project's own CSS (Tailwind, shadcn, DaisyUI).
{
  const css = ["src/theme/tokens.css", "src/theme/globals.css"]
    .map((f) => readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, ""))
    .join("\n");
  const theme = css.match(/@theme inline \{[\s\S]*?\n\}/)?.[0] ?? "";
  const rest = css.replace(theme, "");
  // Theme keys = Tailwind namespace + key: --color-ok-bg, --shadow-ok. The four
  // basics restored after `--color-*: initial` are Tailwind's own names.
  const basics = ["--color-transparent", "--color-current", "--color-white", "--color-black"];
  const keys = [...theme.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]).filter((k) => !/^--[a-z]+-ok(-|$)/.test(k) && !basics.includes(k));
  const vars = [...rest.matchAll(/(?:^|[;{\s])(--[\w-]+)\s*:/g)].map((m) => m[1]).filter((v) => !v.startsWith("--ok-"));
  const selectors = [...rest.matchAll(/([^{};]+)\{/g)].map((m) => m[1]).filter((sel) => !sel.trim().startsWith("@"));
  const classes = selectors.flatMap((sel) => [...sel.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((m) => `.${m[1]}`)).filter((c) => !c.startsWith(".ok-"));
  const attrs = selectors.flatMap((sel) => [...sel.matchAll(/\[(data-[\w-]+)/g)].map((m) => m[1])).filter((a) => !a.startsWith("data-ok-"));
  const frames = [...rest.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1]).filter((k) => !k.startsWith("ok-"));
  const bad = [...new Set([...keys, ...vars, ...classes, ...attrs, ...frames])];
  check(bad.length === 0, `Okapi CSS names all start with ok-${bad.length ? `: ${bad.join(", ")}` : ""}`);
}
// A Tailwind 4 entry can't be imported into a layer (INSTALL.md B4): the build
// fails ("@custom-variant cannot be nested") or Okapi's utilities beat the project's.
if (existsSync("src/theme/project.css")) {
  const layered = [...readFileSync("src/theme/project.css", "utf8").matchAll(/@import\s+(?:url\()?["']([^"']+)["']\)?[^;]*\blayer\b/g)]
    .map((m) => join("src/theme", m[1]))
    .filter((f) => existsSync(f) && /@import\s+["']tailwindcss|@tailwind\b/.test(readFileSync(f, "utf8")));
  check(layered.length === 0, `project CSS: Tailwind imported without a layer${layered.length ? ` (${layered.join(", ")} is inside one: drop layer(...), INSTALL.md B4)` : ""}`);
}

console.log("\n2. Build");
const build = spawnSync(`${pm} astro build`, { encoding: "utf8", shell: true });
if (build.status !== 0) {
  process.stdout.write(build.stdout ?? "");
  process.stderr.write(build.stderr ?? "");
  fail("astro build");
  process.exit(1);
}
ok("astro build");
// Route conflicts are only a build warning. Okapi's [slug] outranks rest params
// like the project's [...slug] (Starlight docs, a blog): a page with that slug
// silently replaces the project's page. List those slugs in reservedSlugs.
const buildLog = `${build.stdout}\n${build.stderr}`.replace(/\x1b\[[0-9;]*m/g, "");
const conflicts = buildLog.split("\n").filter((l) => l.includes("conflicts with higher priority route"));
const stolen = conflicts.filter((l) => /higher priority route `[^`]*\[slug\]`/.test(l));
const hidden = conflicts.filter((l) => /from route `[^`]*\[slug\]`/.test(l));
const slugOf = (l) => l.match(/render `([^`]+)`/)?.[1];
check(stolen.length === 0, `no editor page replaces a project route${stolen.length ? `: ${stolen.map(slugOf).join(", ")} — add them to reservedSlugs in src/okapi.config.json` : ""}`);
if (hidden.length) warn(`editor pages hidden by a project route: ${hidden.map(slugOf).join(", ")} — rename them in the editor`);

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
// Compare with "/" on every OS (join() gives "\\" on Windows).
const publicHtml = htmlFiles.filter((f) => !f.split(sep).join("/").includes(`${outDir}/studio/`));

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
// An editor page at /<slug> on top of a folder of project pages (a locale like
// /es/, a docs folder without an index): no route conflict, so Astro doesn't warn.
{
  const rel = (f) => f.slice(outDir.length + 1).split(sep).join("/");
  const topSlugs = sitePages.map(rel).map((r) => r.match(/^([^/]+)(?:\/index)?\.html$/)?.[1]).filter((s) => s && s !== "index" && s !== "404");
  const covers = topSlugs.filter(
    (slug) => isOkapi(join(outDir, existsSync(join(outDir, slug, "index.html")) ? `${slug}/index.html` : `${slug}.html`)) &&
      sitePages.some((f) => rel(f).startsWith(`${slug}/`) && rel(f) !== `${slug}/index.html` && !isOkapi(f)),
  );
  check(covers.length === 0, `no editor page sits on a folder of project pages${covers.length ? `: /${covers.join(", /")} — add to reservedSlugs in src/okapi.config.json` : ""}`);
}
// The build already fails if Sanity is unreachable. No rendered page with published
// pages = only "home" exists and the project keeps its own home: nothing to serve yet.
const slugs = pageFile ? null : await publishedSlugs();
const noPagesYet = !!slugs && slugs.every((s) => s === "home");
const NOTHING_PUBLISHED = slugs?.length
  ? "the only published page is home, and the home is the project's — create another page in the editor and publish it (with the user's OK: it goes live), then re-run"
  : "no page is published yet — create one in the editor and publish it (with the user's OK: it goes live), then re-run";
if (noPagesYet) warn(`Okapi rendered a page: ${NOTHING_PUBLISHED}`);
else check(!!pageFile, `Okapi rendered a page (${pageFile ? pageFile.slice(outDir.length) : "none — env, dataset or routes?"})`);
if (pageFile) {
  const html = readFileSync(pageFile, "utf8");
  const graph = jsGraph(html);
  const gzKB = Math.round(graph.reduce((n, f) => n + gzipSync(readFileSync(join(outDir, f))).length, 0) / 1024);
  const editorLeak = graph.filter((f) => /comlink|xstate/.test(readFileSync(join(outDir, f), "utf8")));
  check(editorLeak.length === 0, `public pages load no visual-editing runtime (comlink/xstate)${editorLeak.length ? `: ${editorLeak.join(", ")}` : ""}`);
  check(gzKB < 250, `page JS ≤ 250 KB gzip (${gzKB} KB, ${graph.length} files)`);
  // Attribute order free: HTML minifiers reorder them.
  check(/<link\b(?=[^>]*\brel="?canonical"?)(?=[^>]*\bhref="?https?:\/\/)[^>]*>/.test(html), "page has an absolute canonical");
}
const home = readFileSync(index, "utf8");
const welcome = home.includes("Your visual page builder is ready");
if (welcome && noPagesYet) warn(`home shows the <Welcome> setup screen: ${NOTHING_PUBLISHED}`);
else check(!welcome, "home is not the <Welcome> setup screen — env + dataset OK");
check(["sitemap.xml", "sitemap-index.xml"].some((f) => existsSync(join(outDir, f))) && existsSync(join(outDir, "robots.txt")), "sitemap + robots.txt built");
const sitemaps = readdirSync(outDir).filter((f) => /^sitemap.*\.xml$/.test(f));
const listed = sitemaps.filter((f) => /\/(studio|edit-canvas)\/?</.test(readFileSync(join(outDir, f), "utf8")));
check(listed.length === 0, `sitemap leaves out /studio and /edit-canvas${listed.length ? ` (in ${listed.join(", ")}: add the sitemap filter, INSTALL.md B3)` : ""}`);

if (baseUrl) {
  console.log(`\n4. HTTP (${baseUrl})`);
  // A redirect to the same path with a trailing slash (trailingSlash: "always") counts.
  const status = async (path) => {
    const res = await fetch(new URL(path, baseUrl), { redirect: "manual" });
    const to = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && to && new URL(to, baseUrl).pathname === `${path}/`) return status(`${path}/`);
    // `astro dev` with trailingSlash: "always" answers 404, not a redirect, without the slash.
    if (res.status === 404 && !path.endsWith("/")) return status(`${path}/`);
    return res.status;
  };
  check((await status("/")) === 200, "/ → 200");
  check((await status("/studio")) === 200, "/studio → 200");
  check((await status("/edit-canvas")) === 200, "/edit-canvas → 200");
}

console.log(failed ? `\n${failed} check(s) failed.\n` : `\nAll checks passed${warned ? ` (${warned} warning${warned > 1 ? "s" : ""})` : ""}.\n`);
process.exit(failed ? 1 : 0);
