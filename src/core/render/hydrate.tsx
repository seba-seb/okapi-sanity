/**
 * Browser side of the public site's islands (see PageBuilder `islands`).
 * Loaded by Base.astro only when the page has at least one `[data-island]`;
 * each island hydrates on its own root with the same props it was rendered with.
 */
import { hydrateRoot } from "react-dom/client";

import { RoutesContext } from "@/core/lib/routes";
import { watchScrollRefresh } from "@/core/motion/ScrollRefresh";
import { ComponentsContext } from "./components";
import { TopLevel, type IslandProps } from "./PageBuilder";

const routes = JSON.parse(document.getElementById("rmk-routes")?.textContent || "{}");

for (const el of document.querySelectorAll<HTMLElement>("[data-island]")) {
  const { section, ctx, components } = JSON.parse(el.dataset.island!) as IslandProps;
  hydrateRoot(
    el,
    <RoutesContext.Provider value={routes}>
      <ComponentsContext.Provider value={components}>
        <TopLevel section={section} ctx={ctx} />
      </ComponentsContext.Provider>
    </RoutesContext.Provider>,
  );
}

watchScrollRefresh();
