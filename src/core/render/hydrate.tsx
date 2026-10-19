/**
 * Browser side of the public site's islands (see PageBuilder `islands`).
 * Loaded by Base.astro only when the page has at least one `[data-island]`;
 * each island hydrates on its own root with the same props it was rendered with.
 */
import { hydrateRoot, type Root } from "react-dom/client";

import { RoutesContext } from "@/core/lib/routes";
import { ComponentsContext } from "./components";
import { TopLevel, type IslandProps } from "./PageBuilder";

// With <ClientRouter />: hydrate the new page's islands on every soft
// navigation and unmount the old ones before the swap (runs their cleanups).
const roots = new Map<HTMLElement, Root>();

function hydrateIslands() {
  const routes = JSON.parse(document.getElementById("rmk-routes")?.textContent || "{}");
  for (const el of document.querySelectorAll<HTMLElement>("[data-island]")) {
    if (roots.has(el)) continue;
    const { section, ctx, components } = JSON.parse(el.dataset.island!) as IslandProps;
    roots.set(
      el,
      hydrateRoot(
        el,
        <RoutesContext.Provider value={routes}>
          <ComponentsContext.Provider value={components}>
            <TopLevel section={section} ctx={ctx} />
          </ComponentsContext.Provider>
        </RoutesContext.Provider>,
      ),
    );
  }
}

hydrateIslands();
document.addEventListener("astro:page-load", hydrateIslands);
document.addEventListener("astro:before-swap", () => {
  for (const root of roots.values()) root.unmount();
  roots.clear();
});

