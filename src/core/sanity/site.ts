import { loadQuery } from "./client";
import { COMPONENTS_QUERY, NAVIGATION_QUERY, ROUTES_QUERY, SETTINGS_QUERY } from "./queries";
import type { Components } from "@/core/render/components";
import type { SectionData } from "@/core/lib/types";
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
export type Site = { settings: Settings; navigation: Navigation; routes: Routes; components: Components };

// ponytail: module-level cache so a static build fetches site-wide data once,
// not once per page. Build only: in dev it would pin stale content until
// restart.
const CACHE = !import.meta.env.DEV;
let published: Promise<Site> | undefined;

/** Settings, menus and the page-id → slug map every page needs. */
export function loadSite(): Promise<Site> {
  if (CACHE && published) return published;
  const p = Promise.all([
    loadQuery<Settings>(SETTINGS_QUERY),
    loadQuery<Navigation>(NAVIGATION_QUERY),
    loadQuery<{ _id: string; slug: string }[]>(ROUTES_QUERY),
    loadQuery<{ _id: string; title?: string; sections?: SectionData[] }[]>(COMPONENTS_QUERY),
  ]).then(([settings, navigation, routes, components]) => ({
    settings,
    navigation,
    routes: toRoutes(routes),
    components: Object.fromEntries((components ?? []).map((c) => [c._id, c])),
  }));
  if (CACHE) published = p;
  return p;
}
