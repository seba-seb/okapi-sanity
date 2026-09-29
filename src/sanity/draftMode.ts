import { createHash } from "node:crypto";
import type { AstroCookies } from "astro";

import { readToken } from "./env";

export const DRAFT_COOKIE = "__remarkable_draft";

// ponytail: the cookie value is a hash of the server-only read token, so it
// can't be forged without the token and needs no session store. Rotating the
// token logs every editor out of preview — that's fine.
const expected = () =>
  createHash("sha256").update(`draft:${readToken() ?? ""}`).digest("hex");

export function isDraftMode(cookies: AstroCookies): boolean {
  return !!readToken() && cookies.get(DRAFT_COOKIE)?.value === expected();
}

export function enableDraftMode(cookies: AstroCookies, url: URL) {
  // Studio is embedded on the same origin, so the Presentation iframe is
  // same-site: Lax works everywhere. `Secure` only on https — Safari/Firefox
  // drop Secure cookies set over http://localhost.
  cookies.set(DRAFT_COOKIE, expected(), {
    httpOnly: true,
    sameSite: "lax",
    secure: url.protocol === "https:",
    path: "/",
  });
}

export function disableDraftMode(cookies: AstroCookies) {
  cookies.delete(DRAFT_COOKIE, { path: "/" });
}
