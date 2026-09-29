import { createContext, useContext } from "react";

/**
 * Every URL on the site comes from here. Single choke point on purpose: adding
 * a locale prefix or translated slugs later means changing these two functions,
 * not hunting hrefs across components, the sitemap and the canonicals.
 */
export function pageHref(slug: string | undefined | null): string {
  return !slug || slug === "home" ? "/" : `/${slug}`;
}

/** Published page id → slug. Built once per render (see ROUTES_QUERY). */
export type Routes = Record<string, string>;

export function toRoutes(rows: { _id: string; slug: string }[] | null): Routes {
  return Object.fromEntries(
    (rows ?? []).map((r) => [r._id.replace(/^drafts\./, ""), r.slug]),
  );
}

export type LinkValue = {
  kind?: "internal" | "external";
  page?: { _ref?: string };
  anchor?: string;
  url?: string;
  newTab?: boolean;
  /** Legacy shape ({ href, newTab }) from before the `link` type existed. */
  href?: string;
};

export type ResolvedLink = { href: string; target?: "_blank"; rel?: string };

/**
 * `link` object → anchor attributes. `rel` is derived, never editable: an
 * external link that opens a new tab always gets noopener/noreferrer.
 * Returns null when the link points nowhere (e.g. a deleted page).
 */
export function resolveLink(link: LinkValue | undefined, routes: Routes): ResolvedLink | null {
  if (!link) return null;
  const hash = link.anchor ? `#${link.anchor.replace(/^#/, "")}` : "";
  if (link.kind === "internal") {
    const slug = link.page?._ref ? routes[link.page._ref] : undefined;
    if (slug === undefined) return hash ? { href: hash } : null;
    return { href: pageHref(slug) + hash };
  }
  const href = link.kind === "external" ? link.url : link.href;
  if (!href) return null;
  return link.newTab ? { href, target: "_blank", rel: "noopener noreferrer" } : { href };
}

export const RoutesContext = createContext<Routes>({});
export const useRoutes = () => useContext(RoutesContext);
