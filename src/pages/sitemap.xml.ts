import type { APIRoute } from "astro";

import { loadQuery } from "@/core/sanity/client";
import { SITEMAP_QUERY } from "@/core/sanity/queries";
import { pageHref } from "@/core/lib/routes";

// Built with the site (static). Same pageHref() as every link on the site, so
// the sitemap can't disagree with the navigation.
export const GET: APIRoute = async ({ site }) => {
  const pages = (await loadQuery<{ slug: string; _updatedAt: string }[]>(SITEMAP_QUERY)) ?? [];
  const urls = pages
    .map(
      (p) =>
        `  <url><loc>${new URL(pageHref(p.slug), site).href}</loc><lastmod>${p._updatedAt}</lastmod></url>`,
    )
    .join("\n");
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    { headers: { "Content-Type": "application/xml" } },
  );
};
