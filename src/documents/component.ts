import { defineArrayMember, defineField, defineType } from "sanity";
import { ComponentIcon } from "@sanity/icons/Component";

/**
 * A reusable chunk of page (one or more sections), placed on pages through
 * `componentRef` instances. Editing it here changes every instance — like a
 * Webflow component. Same `sections` shape as a page, so the Okapi Editor
 * edits it with all its tools. Instances can't nest (sections only here).
 */
export const component = defineType({
  name: "component",
  title: "Component",
  type: "document",
  icon: ComponentIcon,
  fields: [
    defineField({ name: "title", title: "Name", type: "string", validation: (r) => r.required() }),
    defineField({ name: "sections", title: "Sections", type: "array", of: [defineArrayMember({ type: "section" })] }),
  ],
  preview: { select: { title: "title", sections: "sections" }, prepare: ({ title, sections }) => ({ title, subtitle: `${sections?.length ?? 0} sections` }) },
});
