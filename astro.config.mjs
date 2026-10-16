import { defineConfig, passthroughImageService } from "astro/config";
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

/**
 * The host adapter, picked from where the build runs — so the same repo deploys
 * to Vercel, Netlify or Cloudflare Pages with no edits. Pages stay static; the
 * adapter only exists to run the editor chat's server function
 * (/api/editor-chat), which holds the project's AI key. Any other host: plain
 * static output, chat disabled. REMARKABLE_ADAPTER=vercel|netlify|cloudflare|none overrides.
 */
async function resolveAdapter() {
  const pick = (k) => (env[k] ?? process.env[k] ?? "").trim();
  const host =
    pick("REMARKABLE_ADAPTER") ||
    (pick("VERCEL") ? "vercel" : pick("NETLIFY") ? "netlify" : pick("CF_PAGES") ? "cloudflare" : "none");
  if (host === "vercel") return (await import("@astrojs/vercel")).default();
  if (host === "netlify") return (await import("@astrojs/netlify")).default();
  if (host === "cloudflare") {
    // Not installed by default (it pulls wrangler): `npm i @astrojs/cloudflare wrangler`.
    const mod = await import("@astrojs/cloudflare").catch(() => {
      throw new Error("Deploying to Cloudflare Pages: run `npm i @astrojs/cloudflare wrangler` once, or set REMARKABLE_ADAPTER=none.");
    });
    return mod.default();
  }
  return undefined;
}
const adapter = await resolveAdapter();

/** Adds the editor chat's server route when it can run: in dev, or with a host adapter. */
const editorChat = {
  name: "remarkable-editor-chat",
  hooks: {
    "astro:config:setup": ({ command, injectRoute }) => {
      if (command === "dev" || adapter)
        injectRoute({ pattern: "/api/editor-chat", entrypoint: "./src/core/editor/server/chatRoute.ts", prerender: false });
    },
  },
};

export default defineConfig({
  site: resolveSite(),
  // Static pages on any host. With a host adapter (see resolveAdapter) the one
  // server route is the editor chat; everything else is still prerendered.
  output: "static",
  adapter,
  integrations: [
    editorChat,
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
    // Images come from Sanity's CDN (urlForImage), not astro:assets: no image
    // service, so `sharp` stays out of the chat's server function.
    service: passthroughImageService(),
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
