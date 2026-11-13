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
    return withImageAlt(((await client.fetch<T>(query, params)) ?? null) as T | null);
  } catch (error) {
    if (import.meta.env.PROD) throw new Error(`[loadQuery] Sanity fetch failed — build stopped so the live site stays as it is. ${error}`);
    console.error("[loadQuery] Sanity fetch failed:", error);
    return null;
  }
}

type ImageLike = { alt?: string; asset: { _ref: string } };

/**
 * Alt text belongs to the image: the editor saves it on the asset
 * (`sanity.imageAsset.altText`). Any image value in the result gets it as
 * `alt` — one extra query, only when there are images. An image without
 * asset alt keeps whatever `alt` the block stored (older content).
 */
export async function withImageAlt<T>(data: T): Promise<T> {
  const images: ImageLike[] = [];
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== "object") return;
    const ref = (v as { asset?: { _ref?: unknown } }).asset?._ref;
    if (typeof ref === "string" && ref.startsWith("image-")) images.push(v as ImageLike);
    Object.values(v).forEach(walk);
  };
  walk(data);
  if (!images.length) return data;
  const ids = [...new Set(images.map((i) => i.asset._ref))];
  const rows = await client.fetch<{ _id: string; altText: string }[]>(`*[_id in $ids && defined(altText) && altText != ""]{ _id, altText }`, { ids });
  const alt = new Map(rows.map((r) => [r._id, r.altText]));
  for (const i of images) i.alt = alt.get(i.asset._ref) ?? i.alt;
  return data;
}
