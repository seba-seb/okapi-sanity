import { keyed } from "@/core/sanity/dataAttr";
import { dedupeByKey } from "@/core/lib/dedupe";
import type { Page, SectionData } from "@/core/lib/types";
import { RoutesContext, type Routes } from "@/core/lib/routes";
import { ScrollRefresh } from "@/core/motion/ScrollRefresh";
import { stylesheet } from "@/core/style/stylesheet";

import { Section } from "@/blocks/section/Section";
import { ComponentInstance, ComponentsContext, type Components } from "./components";

/** Normalizes a Sanity id: strips `drafts.` and `versions.<release>.` prefixes. */
const baseIdOf = (id: string | undefined) => (id ?? "").replace(/^drafts\./, "").replace(/^versions\.[^.]+\./, "");
const NO_COMPONENTS: Components = {};

/**
 * Renders a page (or component) document. The same component serves the
 * public site (static data) and the editor canvas (whatever the editor posts).
 */
export function PageBuilder({ page, routes, components = NO_COMPONENTS }: { page: Page; routes: Routes; components?: Components }) {
  const ctx = { documentId: baseIdOf(page._id), documentType: page._type ?? "page" };
  const sections = page.sections;
  if (!sections?.length) return null;
  // Styles for the page's blocks AND the blocks of every component it uses.
  const used = sections
    .filter((s) => s._type === "componentRef")
    .map((s) => components[(s as { component?: { _ref?: string } }).component?._ref ?? ""]?.sections ?? []);
  const css = stylesheet([sections, ...used]);
  return (
    <RoutesContext.Provider value={routes}>
      <ComponentsContext.Provider value={components}>
        <ScrollRefresh />
        {css ? <style>{css}</style> : null}
        <main>
          {dedupeByKey(sections).map((section) =>
            section._type === "componentRef" ? (
              <ComponentInstance key={section._key} block={section} path={keyed("sections", section._key)} ctx={ctx} />
            ) : (
              <Section key={section._key} section={section as SectionData} path={keyed("sections", section._key)} ctx={ctx} />
            ),
          )}
        </main>
      </ComponentsContext.Provider>
    </RoutesContext.Provider>
  );
}
