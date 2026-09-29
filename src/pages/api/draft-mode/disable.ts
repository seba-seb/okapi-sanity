import type { APIRoute } from "astro";

import { disableDraftMode } from "@/core/sanity/draftMode";

export const prerender = false;

export const GET: APIRoute = ({ cookies, redirect }) => {
  disableDraftMode(cookies);
  return redirect("/", 307);
};
