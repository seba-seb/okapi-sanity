import { createContext, useContext, useMemo } from "react";

import type { Block, RenderContext, SectionData } from "@/core/lib/types";
import { editable } from "@/core/sanity/dataAttr";
import { dedupeByKey } from "@/core/lib/dedupe";
import { Section } from "@/blocks/section/Section";
import { applyOverrides, OVERRIDE_MARK, type Override } from "./overrides";

/** Library components by id: what `componentRef` instances render. */
export type Components = Record<string, { title?: string; sections?: SectionData[] }>;
export const ComponentsContext = createContext<Components>({});

/**
 * One instance: the component's sections inside a wrapper the editor treats
 * as a single selectable block (`data-instance`). Inner blocks get synthetic
 * paths (…`.__component.`…): editing their text / images on the canvas writes
 * per-instance `overrides`; the component document itself stays untouched.
 */
export function ComponentInstance({ block, path, ctx }: { block: Block; path: string; ctx: RenderContext }) {
  const components = useContext(ComponentsContext);
  const ref = (block.component as { _ref?: string } | undefined)?._ref;
  const comp = ref ? components[ref] : undefined;
  const overrides = block.overrides as Override[] | undefined;
  const sections = useMemo(() => applyOverrides(comp?.sections, overrides), [comp?.sections, overrides]);
  const label = `Component — ${comp?.title ?? "missing"}`;
  return (
    <div data-instance="" {...editable(ctx.documentId, ctx.documentType, path, "componentRef", label)}>
      {sections?.length ? (
        dedupeByKey(sections).map((s) => <Section key={s._key} section={s} path={`${path}${OVERRIDE_MARK}sections[_key=="${s._key}"]`} ctx={ctx} />)
      ) : ctx.documentType === "page" && typeof window !== "undefined" && location.pathname.startsWith("/edit-canvas") ? (
        <p style={{ padding: 24, font: "14px system-ui", opacity: 0.6 }}>{ref ? "This component is missing or empty." : "Pick a component in the panel."}</p>
      ) : null}
    </div>
  );
}
