/**
 * Everything Okapi needs in astro.config, as functions the project imports, so
 * nothing is pasted by hand and it type-checks in astro.config.mjs and .ts alike:
 *
 *   import { okapi, okapiAdapter, okapiSanity, okapiSite } from "./src/core/astro/okapi";
 *   const adapter = await okapiAdapter(); // or the project's own adapter
 *   export default defineConfig({
 *     site: okapiSite(), adapter,
 *     integrations: [okapi({ adapter }), okapiSanity(), react()],
 *     vite: { plugins: [tailwindcss()] },
 *   });
 *
 * Loaded by Astro's config loader (Node), so relative imports only, no `@/`.
 */
import { readdirSync, readFileSync } from "node:fs";
import type { AstroIntegration } from "astro";
import sanity from "@sanity/astro";
import { loadEnv, type Plugin } from "vite";

// astro.config runs before Astro loads .env, so read it with Vite's loader.
const env = loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "");
const pick = (...keys: string[]) => keys.map((k) => (env[k] ?? process.env[k] ?? "").trim()).find(Boolean);

// The project's Okapi choices (npm run okapi:setup).
type OkapiConfig = { features?: { chat?: boolean }; blocks?: Record<string, boolean> };
const config: OkapiConfig = (() => {
  try {
    return JSON.parse(readFileSync(new URL("../../okapi.config.json", import.meta.url), "utf8"));
  } catch {
    return {};
  }
})();
const chatEnabled = config.features?.chat !== false;

/**
 * Every `@sanity/icons/<Icon>`, `@sanity/ui/<part>` and `@sanity/themer` import
 * in src/ and sanity.config.ts. Each subpath is its own entry for Vite: listed
 * up front, so the first /studio load doesn't discover them and re-optimize
 * (504 Outdated Optimize Dep, blank Studio).
 */
function sanitySubpaths(): string[] {
  const src = new URL("../../", import.meta.url);
  const files = (readdirSync(src, { recursive: true }) as string[])
    .filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes("node_modules"))
    .map((f) => new URL(f, src));
  files.push(new URL("../sanity.config.ts", src));
  const found = new Set<string>();
  for (const f of files) {
    let code = "";
    try {
      code = readFileSync(f, "utf8");
    } catch {
      continue;
    }
    for (const m of code.matchAll(/from\s+["'](@sanity\/(?:icons|ui)\/[\w/-]+|@sanity\/themer)["']/g)) found.add(m[1]);
  }
  return [...found].sort();
}

/**
 * The absolute origin for canonicals, og:url and the sitemap. PUBLIC_SITE_URL
 * wins; otherwise the host's per-deploy URL so preview deploys don't point
 * their canonicals at production. Empty counts as unset (that's what a hosting
 * panel produces), and a value without a scheme gets https://.
 */
export function okapiSite(): string {
  const raw = pick("PUBLIC_SITE_URL");
  const candidate =
    raw ||
    pick("VERCEL_PROJECT_PRODUCTION_URL", "VERCEL_URL") || // Vercel
    pick("URL") || // Netlify
    pick("CF_PAGES_URL") || // Cloudflare Pages
    "http://localhost:4321";
  const withScheme = /^https?:\/\//.test(candidate) ? candidate : `https://${candidate}`;
  try {
    return new URL(withScheme).origin;
  } catch {
    throw new Error(
      `PUBLIC_SITE_URL is not a valid URL: ${JSON.stringify(raw)}. ` +
        "Use a full origin like https://example.com, or delete the variable instead of leaving it empty.",
    );
  }
}

/**
 * The host adapter, picked from where the build runs — so the same repo deploys
 * to Vercel, Netlify or Cloudflare with no edits. Pages stay static; the adapter
 * only exists to run the editor chat's server function (/api/editor-chat),
 * which holds the project's AI key. Any other host: plain static output, chat
 * disabled. OKAPI_ADAPTER=vercel|netlify|cloudflare|none overrides. Chat off
 * (okapi.config.json) = no adapter.
 */
export async function okapiAdapter(): Promise<AstroIntegration | undefined> {
  if (!chatEnabled) return undefined;
  const host =
    pick("OKAPI_ADAPTER") ||
    (pick("VERCEL") ? "vercel" : pick("NETLIFY") ? "netlify" : pick("CF_PAGES") ? "cloudflare" : "none");
  // The adapters are optional (okapi:setup removes them with --chat=no): no type check on these imports.
  // @ts-ignore
  if (host === "vercel") return (await import("@astrojs/vercel")).default();
  // @ts-ignore
  if (host === "netlify") return (await import("@astrojs/netlify")).default();
  if (host === "cloudflare") {
    // Not installed by default (it pulls wrangler): `npm i @astrojs/cloudflare wrangler`.
    // @ts-ignore
    const mod = await import("@astrojs/cloudflare").catch(() => {
      throw new Error("Deploying to Cloudflare: run `npm i @astrojs/cloudflare wrangler` once, or set OKAPI_ADAPTER=none.");
    });
    return mod.default();
  }
  return undefined;
}

/** The embedded Studio, at /studio. */
export function okapiSanity(): AstroIntegration {
  return sanity({
    projectId: pick("PUBLIC_SANITY_PROJECT_ID") || "missing",
    dataset: pick("PUBLIC_SANITY_DATASET") || "production",
    apiVersion: pick("PUBLIC_SANITY_API_VERSION") || "2024-10-01",
    useCdn: false,
    studioBasePath: "/studio",
    // The build emits a single /studio/index.html; hash routing keeps
    // /studio#/editor reloadable without a hosting catch-all.
    studioRouterHistory: "hash",
  });
}

/**
 * Okapi's own integration: the editor chat route, the project's trailingSlash
 * handed to core, Sanity's image CDN, and Vite's pre-bundle list. Merges into
 * the project's config (lists add up), so the project keeps its own.
 */
export function okapi({ adapter }: { adapter?: unknown } = {}): AstroIntegration {
  // Read at astro:config:done, after every integration ran: some set
  // trailingSlash themselves (AstroWind's does). Vite reads it later, here.
  let trailingSlash = "ignore";
  const trailingSlashPlugin: Plugin = {
    name: "okapi-trailing-slash",
    // Core's sitePath() (core/sanity/env.ts) builds paths with it.
    config: () => ({ define: { "import.meta.env.PUBLIC_OKAPI_TRAILING_SLASH": JSON.stringify(trailingSlash) } }),
  };
  const blocks = config.blocks ?? {};
  return {
    name: "okapi",
    hooks: {
      "astro:config:setup": ({ command, injectRoute, updateConfig }) => {
        if (chatEnabled && (command === "dev" || adapter))
          injectRoute({ pattern: "/api/editor-chat", entrypoint: new URL("../editor/server/chatRoute.ts", import.meta.url), prerender: false });
        updateConfig({
          image: { remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }] },
          vite: {
            plugins: [trailingSlashPlugin],
            // build/check get their own Vite cache: sharing node_modules/.vite with a
            // running dev server swaps its React runtime for the production one
            // ("_jsxDEV is not a function", islands and Studio stop hydrating).
            cacheDir: command === "dev" ? undefined : "node_modules/.vite-build",
            optimizeDeps: {
              // Crawl EVERY source file at startup — the public pages, the editor
              // canvas and the Studio — so no dependency is discovered mid-session. A
              // late discovery re-optimizes, and the open tab's lazy chunks then 504
              // (blank Studio after sign-in, or a canvas that never hydrates).
              // Not core/astro: it's config code (Node), and its optional adapter
              // imports would fail the whole scan when they aren't installed.
              entries: ["src/**/*.{ts,tsx,astro,vue,svelte}", "!src/core/astro/**", "sanity.config.ts"],
              include: [
                "@sanity/client",
                "@sanity/client/stega",
                "@sanity/image-url",
                "@portabletext/react",
                "groq",
                "react/compiler-runtime",
                // Optional blocks: only the ones this project kept.
                ...(blocks.slider !== false ? ["embla-carousel-react"] : []),
                ...(blocks.logo3d !== false ? ["three"] : []),
                // The embedded Studio's entry points: without these Vite discovers them
                // on the first /studio load and re-optimizes mid-session.
                "sanity",
                "sanity/structure",
                "@sanity/ui",
                "@sanity/icons",
                "styled-components",
                ...sanitySubpaths(),
                // <ClientRouter /> (view transitions), if the project uses it: found late otherwise → 504.
                "astro/virtual-modules/transitions-events.js",
                "astro/virtual-modules/transitions-router.js",
                "astro/virtual-modules/transitions-swap-functions.js",
                "astro/virtual-modules/transitions-types.js",
              ],
            },
          },
        });
      },
      "astro:config:done": ({ config }) => {
        trailingSlash = config.trailingSlash;
      },
    },
  };
}
