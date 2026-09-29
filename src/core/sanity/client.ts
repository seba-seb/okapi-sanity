import { createClient, type QueryParams } from "@sanity/client";

import { apiVersion, dataset, projectId, readToken, studioUrl } from "@/core/sanity/env";

export const client = createClient({
  projectId: projectId || "missing",
  dataset,
  apiVersion,
  useCdn: true,
  stega: { studioUrl },
});

/**
 * Published content for static pages, drafts for the preview routes. Stega is
 * off in both — click-to-edit runs off the explicit `data-sanity` attributes
 * stamped by `editable()`. Returns `null` on failure so pages can fall back
 * (e.g. <Welcome /> before the project is configured).
 */
export async function loadQuery<T>(
  query: string,
  params: QueryParams = {},
  { drafts = false } = {},
): Promise<T | null> {
  if (!projectId) return null;
  try {
    const c = drafts
      ? client.withConfig({ token: readToken(), useCdn: false, perspective: "drafts" })
      : client.withConfig({ perspective: "published" });
    return ((await c.fetch<T>(query, params, { stega: false })) ?? null) as T | null;
  } catch (error) {
    console.error("[loadQuery] Sanity fetch failed:", error);
    return null;
  }
}
