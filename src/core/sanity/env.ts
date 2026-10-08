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

/** Where the embedded Studio lives, used for click-to-edit links. */
export const studioUrl = "/studio";

