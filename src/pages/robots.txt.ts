import type { APIRoute } from "astro";

export const prerender = true;

export const GET: APIRoute = ({ site }) =>
  new Response(
    [
      "User-agent: *",
      "Disallow: /studio",
      "Disallow: /edit-canvas",
      "",
      `Sitemap: ${new URL("/sitemap.xml", site).href}`,
      "",
    ].join("\n"),
    { headers: { "Content-Type": "text/plain" } },
  );
