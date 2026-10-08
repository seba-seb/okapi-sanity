import { keyed } from "@/core/sanity/dataAttr";
import { dedupeByKey } from "@/core/lib/dedupe";
import type { Page } from "@/core/lib/types";
import { RoutesContext, type Routes } from "@/core/lib/routes";
import { ScrollRefresh } from "@/core/motion/ScrollRefresh";

import { Section } from "@/blocks/section/Section";

/** Normalizes a Sanity id: strips `drafts.` and `versions.<release>.` prefixes. */
const baseIdOf = (id: string | undefined) => (id ?? "").replace(/^drafts\./, "").replace(/^versions\.[^.]+\./, "");

/**
 * Renders a page document. The same component serves the public site
 * (static data) and the editor canvas (whatever document the editor posts).
 */
export function PageBuilder({ page, routes }: { page: Page; routes: Routes }) {
  const ctx = { documentId: baseIdOf(page._id), documentType: "page" };
  const sections = page.sections;
  if (!sections?.length) return null;
  return (
    <RoutesContext.Provider value={routes}>
      <ScrollRefresh />
      <main>
        {dedupeByKey(sections).map((section) => (
          <Section key={section._key} section={section} path={keyed("sections", section._key)} ctx={ctx} />
        ))}
      </main>
    </RoutesContext.Provider>
  );
}
