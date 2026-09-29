import { loadQuery } from "./client";
import { NAVIGATION_QUERY, ROUTES_QUERY, SETTINGS_QUERY } from "./queries";
import { toRoutes, type Routes } from "@/core/lib/routes";
import type { SanityImage } from "@/core/lib/types";

export type NavItem = { _key: string; label?: string; link?: import("@/core/lib/routes").LinkValue };
export type Settings = {
  siteName?: string;
  description?: string;
  ogImage?: SanityImage;
  socialLinks?: NavItem[];
} | null;
export type Navigation = { header?: NavItem[]; footer?: NavItem[] } | null;
export type Site = { settings: Settings; navigation: Navigation; routes: Routes };

// ponytail: module-level cache so a static build fetches site-wide data once,
// not once per page. Build only: in dev it would pin stale content until
// restart. Drafts (preview) are never cached.
const CACHE = !import.meta.env.DEV;
let published: Promise<Site> | undefined;

/** Settings, menus and the page-id → slug map every page needs. */
export function loadSite({ drafts = false } = {}): Promise<Site> {
  if (CACHE && !drafts && published) return published;
  const p = Promise.all([
    loadQuery<Settings>(SETTINGS_QUERY, {}, { drafts }),
    loadQuery<Navigation>(NAVIGATION_QUERY, {}, { drafts }),
    loadQuery<{ _id: string; slug: string }[]>(ROUTES_QUERY, {}, { drafts }),
  ]).then(([settings, navigation, routes]) => ({ settings, navigation, routes: toRoutes(routes) }));
  if (CACHE && !drafts) published = p;
  return p;
}
