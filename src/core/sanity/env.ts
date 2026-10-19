// `import.meta.env` covers Astro + the embedded Studio (Vite); `process.env`
// covers the Sanity CLI / Node scripts that import this file.
const env = (key: string): string | undefined =>
  (import.meta as { env?: Record<string, string | undefined> }).env?.[key] ||
  (typeof process !== "undefined" ? process.env[key] : undefined) ||
  undefined;

export const apiVersion = env("PUBLIC_SANITY_API_VERSION") || "2024-10-01";

// ponytail: empty string instead of throwing, so the site renders <Welcome />
// before Sanity is configured (same behaviour as the Next version).
export const dataset = env("PUBLIC_SANITY_DATASET") || "production";
export const projectId = env("PUBLIC_SANITY_PROJECT_ID") || "";

/** Build-time only, for private datasets. Never read this from client code. */
export const readToken = () => env("SANITY_API_READ_TOKEN");

/**
 * A site path in the form Astro serves it: "/about" → "/about/" when the
 * project sets `trailingSlash: "always"` (the okapi integration in
 * astro.config.mjs hands the value to core). Every path core builds goes
 * through here; with "always" the slashless one is a 404 in dev.
 */
export const sitePath = (path: string): string =>
  env("PUBLIC_OKAPI_TRAILING_SLASH") === "always" && !path.endsWith("/") ? `${path}/` : path;

/** The editor canvas route (data-free; see core/editor). Here, not in the
 * editor protocol, so public code never imports editor modules. */
export const CANVAS_PATH = sitePath("/edit-canvas");

/** Where the embedded Studio lives, used for click-to-edit links. */
export const studioUrl = sitePath("/studio");

