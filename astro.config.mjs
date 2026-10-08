import { defineConfig } from "astro/config";
import react from "@astrojs/react";
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
  // Fully static: the editor writes to Sanity from the Studio; the site has
  // no server routes. Any static host works (dist/).
  output: "static",
  integrations: [
    sanity({
      projectId: PUBLIC_SANITY_PROJECT_ID || "missing",
      dataset: PUBLIC_SANITY_DATASET || "production",
      apiVersion: PUBLIC_SANITY_API_VERSION || "2024-10-01",
      useCdn: false,
      studioBasePath: "/studio",
      // The build emits a single /studio/index.html; hash routing keeps
      // /studio#/editor reloadable without a hosting catch-all.
      studioRouterHistory: "hash",
    }),
    react(),
  ],
  image: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.sanity.io" }],
  },
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      // Crawl EVERY source file at startup — the public pages, the editor
      // canvas and the Studio — so no dependency is discovered mid-session. A
      // late discovery re-optimizes, and the open tab's lazy chunks then 504
      // (blank Studio after sign-in, or a canvas that never hydrates).
      entries: ["src/**/*.{ts,tsx,astro}", "sanity.config.ts"],
      include: [
        "@sanity/client",
        "@sanity/client/stega",
        "@sanity/image-url",
        "@portabletext/react",
        "groq",
        "react/compiler-runtime",
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
        "@sanity/ui",
        "@sanity/icons",
        "styled-components",
      ],
    },
  },
});
