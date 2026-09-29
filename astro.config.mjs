import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import vercel from "@astrojs/vercel";
import sanity from "@sanity/astro";
import { loadEnv } from "vite";

// astro.config runs before Astro loads .env, so read it with Vite's loader.
const { PUBLIC_SANITY_PROJECT_ID, PUBLIC_SANITY_DATASET, PUBLIC_SANITY_API_VERSION } =
  loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "");

export default defineConfig({
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
    // @sanity/visual-editing pulls these through paths Vite's optimizer misses
    // → "504 Outdated Optimize Dep" and the overlay never mounts in dev.
    optimizeDeps: {
      include: [
        "react/compiler-runtime",
        "lodash/isObject.js",
        "lodash/groupBy.js",
        "lodash/keyBy.js",
        "lodash/partition.js",
        "lodash/sortedIndex.js",
        "embla-carousel-react",
        "three",
      ],
    },
  },
});
