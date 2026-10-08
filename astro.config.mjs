import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import vercel from "@astrojs/vercel";
import sanity from "@sanity/astro";
import { loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";

// astro.config runs before Astro loads .env, so read it with Vite's loader.
const env = loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "");
const { PUBLIC_SANITY_PROJECT_ID, PUBLIC_SANITY_DATASET, PUBLIC_SANITY_API_VERSION } = env;

/**
 * The absolute origin for canonicals, og:url and the sitemap. PUBLIC_SITE_URL
 * wins; otherwise the host's per-deploy URL so preview deploys don't point
 * their canonicals at production. Empty counts as unset (that's what a hosting
 * panel produces), and a value without a scheme gets https://.
 */
function resolveSite() {
  const pick = (...keys) => keys.map((k) => (env[k] ?? process.env[k] ?? "").trim()).find(Boolean);
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

export default defineConfig({
  site: resolveSite(),
  // Public pages stay static; only /preview/* and /api/draft-mode/* opt out
  // with `export const prerender = false`.
  output: "static",
  adapter: vercel(),
  integrations: [
    sanity({
      projectId: PUBLIC_SANITY_PROJECT_ID || "missing",
      dataset: PUBLIC_SANITY_DATASET || "production",
      apiVersion: PUBLIC_SANITY_API_VERSION || "2024-10-01",
      useCdn: false,
      studioBasePath: "/studio",
      // The build emits a single /studio/index.html; hash routing keeps
      // /studio#/presentation reloadable without a hosting catch-all.
      studioRouterHistory: "hash",
    }),
    react(),
  ],
  image: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }],
  },
  vite: {
    plugins: [tailwindcss()],
    // @sanity/visual-editing pulls these through paths Vite's optimizer misses
    // → "504 Outdated Optimize Dep" and the overlay never mounts in dev.
    optimizeDeps: {
      // Crawl EVERY source file at startup — the public pages, /preview (the
      // visual editor's deps) and the Studio — so no dependency is discovered
      // mid-session. A late discovery re-optimizes, and the open tab's lazy
      // chunks (e.g. visual-editing's LoaderComlink) then 504: blank Studio,
      // or a preview you can see but not edit.
      entries: ["src/**/*.{ts,tsx,astro}", "sanity.config.ts"],
      include: [
        "@sanity/visual-editing",
        "@sanity/visual-editing/react",
        "@sanity/visual-editing/create-data-attribute",
        "@sanity/mutate",
        "@sanity/client",
        "@sanity/client/stega",
        "@sanity/image-url",
        "@portabletext/react",
        "groq",
        "react/compiler-runtime",
        "lodash/isObject.js",
        "lodash/groupBy.js",
        "lodash/keyBy.js",
        "lodash/partition.js",
        "lodash/sortedIndex.js",
        "embla-carousel-react",
        "three",
        "gsap",
        "gsap/SplitText",
        "gsap/ScrollTrigger",
        "@gsap/react",
        // The embedded Studio's entry points: without these Vite discovers them
        // on the first /studio load and re-optimizes mid-session, and the open
        // tab's lazy chunks then 504 → blank Studio after sign-in.
        "sanity",
        "sanity/structure",
        "sanity/presentation",
        "@sanity/ui",
        "@sanity/icons",
        "styled-components",
      ],
    },
  },
});
