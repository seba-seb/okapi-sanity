import { editable, keyed } from "@/core/sanity/dataAttr";
import { clean } from "@/core/lib/clean";
import { resolveLink, type Routes } from "@/core/lib/routes";
import { NAVIGATION_QUERY } from "@/core/sanity/queries";
import { useLiveQuery } from "@/core/render/useLiveQuery";
import type { Navigation, Settings } from "@/core/sanity/site";

const EMPTY = {};

/** Project chrome, not core. Renders nothing until there are footer items. */
export function SiteFooter({
  navigation,
  settings,
  routes,
}: {
  navigation: Navigation;
  settings: Settings;
  routes: Routes;
}) {
  const nav = useLiveQuery(NAVIGATION_QUERY, EMPTY, navigation);
  const items = [...(nav?.footer ?? []), ...(settings?.socialLinks ?? [])];
  if (!items.length) return null;
  return (
    <footer className="site-footer">
      <ul className="site-footer__links">
        {(nav?.footer ?? []).map((item) => (
          <li key={item._key}>
            <a
              {...(resolveLink(clean(item.link), routes) ?? { href: "#" })}
              {...editable("navigation", "navigation", keyed("footer", item._key), "navItem", "Menu item")}
            >
              {clean(item.label)}
            </a>
          </li>
        ))}
        {(settings?.socialLinks ?? []).map((item) => (
          <li key={item._key}>
            <a {...(resolveLink(clean(item.link), routes) ?? { href: "#" })}>{clean(item.label)}</a>
          </li>
        ))}
      </ul>
      <p className="site-footer__copy">
        © {new Date().getFullYear()} {clean(settings?.siteName)}
      </p>
    </footer>
  );
}
