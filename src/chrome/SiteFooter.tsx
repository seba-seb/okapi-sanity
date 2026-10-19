import { editable, keyed } from "@/core/sanity/dataAttr";
import { clean } from "@/core/lib/clean";
import { resolveLink, type Routes } from "@/core/lib/routes";
import type { Navigation, Settings } from "@/core/sanity/site";

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
  const nav = navigation;
  const items = [...(nav?.footer ?? []), ...(settings?.socialLinks ?? [])];
  if (!items.length) return <></>; // not null: with a second renderer (Vue, Svelte) Astro can't tell whose component returns null
  return (
    <footer className="ok-site-footer">
      <ul className="ok-site-footer__links">
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
      <p className="ok-site-footer__copy">
        © {new Date().getFullYear()} {clean(settings?.siteName)}
      </p>
    </footer>
  );
}
