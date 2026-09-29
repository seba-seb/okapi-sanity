import { editable, keyed } from "@/core/sanity/dataAttr";
import { clean } from "@/core/lib/clean";
import { pageHref, resolveLink, type Routes } from "@/core/lib/routes";
import { NAVIGATION_QUERY } from "@/core/sanity/queries";
import { useLiveQuery } from "@/core/render/useLiveQuery";
import type { Navigation, Settings } from "@/core/sanity/site";

const EMPTY = {};

/**
 * Project chrome, not core: restyle or replace per project. Renders nothing
 * until the Navigation document has header items, so a fresh project looks
 * exactly like its page content.
 */
export function SiteHeader({
  navigation,
  settings,
  routes,
}: {
  navigation: Navigation;
  settings: Settings;
  routes: Routes;
}) {
  const nav = useLiveQuery(NAVIGATION_QUERY, EMPTY, navigation);
  const items = nav?.header ?? [];
  if (!items.length) return null;
  return (
    <header className="site-header">
      <a className="site-header__brand" href={pageHref("home")}>
        {clean(settings?.siteName) || "Home"}
      </a>
      <nav aria-label="Main">
        <ul className="site-header__links">
          {items.map((item) => (
            <li key={item._key}>
              <a
                {...(resolveLink(clean(item.link), routes) ?? { href: "#" })}
                {...editable("navigation", "navigation", keyed("header", item._key), "navItem", "Menu item")}
              >
                {clean(item.label)}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
