import type { APIRoute } from "astro";

export const GET: APIRoute = ({ site }) =>
  new Response(
    [
      "User-agent: *",
      "Disallow: /preview",
      "Disallow: /studio",
      "Disallow: /api",
      "",
      `Sitemap: ${new URL("/sitemap.xml", site).href}`,
      "",
    ].join("\n"),
    { headers: { "Content-Type": "text/plain" } },
  );
