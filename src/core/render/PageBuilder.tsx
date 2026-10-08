import { keyed } from "@/core/sanity/dataAttr";
import { dedupeByKey } from "@/core/lib/dedupe";
import type { Page, SectionData } from "@/core/lib/types";
import { RoutesContext, type Routes } from "@/core/lib/routes";
import { ScrollRefresh } from "@/core/motion/ScrollRefresh";
import { stylesheet } from "@/core/style/stylesheet";

import { Section } from "@/blocks/section/Section";
import { needsJs } from "@/blocks/meta";
import type { Block, RenderContext } from "@/core/lib/types";
import { ComponentInstance, ComponentsContext, type Components } from "./components";

/** Normalizes a Sanity id: strips `drafts.` and `versions.<release>.` prefixes. */
const baseIdOf = (id: string | undefined) => (id ?? "").replace(/^drafts\./, "").replace(/^versions\.[^.]+\./, "");
const NO_COMPONENTS: Components = {};

/** One top-level item of `sections`: a section or a component instance. */
export function TopLevel({ section, ctx }: { section: Block; ctx: RenderContext }) {
  const path = keyed("sections", section._key);
  return section._type === "componentRef" ? (
    <ComponentInstance block={section} path={path} ctx={ctx} />
  ) : (
    <Section section={section as SectionData} path={path} ctx={ctx} />
  );
}

/** Island props: everything `hydrate.tsx` needs to re-render one top-level item. */
export type IslandProps = { section: Block; ctx: RenderContext; components: Components };
const json = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");

/**
 * Renders a page (or component) document. The same component serves the
 * public site (static data) and the editor canvas (whatever the editor posts).
 *
 * `islands` (public site, rendered on the server only): the page ships as
 * plain HTML, and each top-level item holding a block that needs JS (see
 * `BlockMeta.js`) is wrapped as an island that `hydrate.tsx` brings to life.
 * A page with no such block loads no JS at all.
 */
export function PageBuilder({
  page,
  routes,
  components = NO_COMPONENTS,
  islands = false,
}: {
  page: Page;
  routes: Routes;
  components?: Components;
  islands?: boolean;
}) {
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
        {islands ? null : <ScrollRefresh />}
        {css ? <style>{css}</style> : null}
        <main>
          {dedupeByKey(sections).map((section) => {
            const ref = (section.component as { _ref?: string } | undefined)?._ref;
            const comp = ref ? components[ref] : undefined;
            if (!islands || !needsJs(comp?.sections ?? section)) return <TopLevel key={section._key} section={section} ctx={ctx} />;
            const props: IslandProps = { section, ctx, components: ref && comp ? { [ref]: comp } : NO_COMPONENTS };
            return (
              <div key={section._key} data-island={json(props)} style={{ display: "contents" }}>
                <TopLevel section={section} ctx={ctx} />
              </div>
            );
          })}
        </main>
        {islands ? <script type="application/json" id="rmk-routes" dangerouslySetInnerHTML={{ __html: json(routes) }} /> : null}
      </ComponentsContext.Provider>
    </RoutesContext.Provider>
  );
}
