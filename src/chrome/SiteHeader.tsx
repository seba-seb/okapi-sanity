import { editable, keyed } from "@/core/sanity/dataAttr";
import { clean } from "@/core/lib/clean";
import { pageHref, resolveLink, type Routes } from "@/core/lib/routes";
import type { Navigation, Settings } from "@/core/sanity/site";

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
  const nav = navigation;
  const items = nav?.header ?? [];
  if (!items.length) return <></>; // not null: with a second renderer (Vue, Svelte) Astro can't tell whose component returns null
  return (
    <header className="ok-site-header">
      <a className="ok-site-header__brand" href={pageHref("home")}>
        {clean(settings?.siteName) || "Home"}
      </a>
      <nav aria-label="Main">
        <ul className="ok-site-header__links">
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
