import { createClient, type QueryParams } from "@sanity/client";

import { apiVersion, dataset, projectId, readToken } from "@/core/sanity/env";

export const client = createClient({
  projectId: projectId || "missing",
  dataset,
  apiVersion,
  // No CDN: pages are fetched at build time (a handful of requests), and a
  // publish-triggered rebuild must never read a stale cached response.
  useCdn: false,
  perspective: "published",
  // Only needed when the dataset is private; public datasets read without it.
  token: readToken(),
});

/**
 * Published content for the static site. In dev it returns `null` on failure
 * so pages can fall back (e.g. <Welcome /> before the project is configured).
 * A production build fails instead: an unreachable Sanity or missing env must
 * never deploy an empty site.
 */
export async function loadQuery<T>(query: string, params: QueryParams = {}): Promise<T | null> {
  if (!projectId) {
    if (import.meta.env.PROD) throw new Error("[loadQuery] PUBLIC_SANITY_PROJECT_ID is not set: refusing to build an empty site.");
    return null;
  }
  try {
    return ((await client.fetch<T>(query, params)) ?? null) as T | null;
  } catch (error) {
    if (import.meta.env.PROD) throw new Error(`[loadQuery] Sanity fetch failed — build stopped so the live site stays as it is. ${error}`);
    console.error("[loadQuery] Sanity fetch failed:", error);
    return null;
  }
}
