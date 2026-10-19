/**
 * The project's Okapi choices (src/okapi.config.json, written by
 * `npm run okapi:setup`). Core features read these flags instead of being
 * removed, so core stays identical in every project.
 */
import raw from "@/okapi.config.json";

type Raw = { features?: { chat?: boolean; components?: boolean }; pagesBase?: string; reservedSlugs?: string[] };
const r = raw as Raw;
const f = r.features ?? {};

export const FEATURES = {
  /** ✦ Chat tab + /api/editor-chat (needs a host that runs functions + an AI key). */
  chat: f.chat !== false,
  /** Reusable library components (`component` documents + `componentRef` instances). */
  components: f.components !== false,
} as const;

/**
 * Where editor pages are served: "" → /<slug>, "/p" → /p/<slug>. The route file
 * has to match: src/pages/[slug].astro or src/pages/p/[slug].astro.
 */
export const PAGES_BASE = `/${r.pagesBase ?? ""}`.replace(/\/+/g, "/").replace(/\/$/, "");

/**
 * Slugs the project already uses (its blog, docs folders, locales…). A page with
 * one of these would replace the project's route: Okapi's [slug] outranks rest
 * params like [...slug]. The Studio rejects them and [slug].astro skips them.
 */
export const RESERVED_SLUGS: readonly string[] = r.reservedSlugs ?? [];
