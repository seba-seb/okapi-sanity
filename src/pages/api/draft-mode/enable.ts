import type { APIRoute } from "astro";
import { validatePreviewUrl } from "@sanity/preview-url-secret";

import { client } from "@/core/sanity/client";
import { readToken, previewPrefix } from "@/core/sanity/env";
import { enableDraftMode } from "@/core/sanity/draftMode";

export const prerender = false;

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
  const token = readToken();
  if (!token) return new Response("SANITY_API_READ_TOKEN is not set", { status: 500 });

  // No CDN (the secret was written a moment ago) and published perspective
  // (the secret document is published, not a draft).
  const { isValid, redirectTo = previewPrefix } = await validatePreviewUrl(
    client.withConfig({ token, useCdn: false, perspective: "published" }),
    request.url,
  );
  if (!isValid) return new Response("Invalid secret", { status: 401 });

  enableDraftMode(cookies, new URL(request.url));
  // Only ever redirect inside the preview tree.
  return redirect(redirectTo.startsWith(previewPrefix) ? redirectTo : previewPrefix, 307);
};
