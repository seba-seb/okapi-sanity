import { defineField, defineType } from "sanity";
import { LinkIcon } from "@sanity/icons";

/**
 * Internal links PICK a page (they can't be mistyped, and follow slug
 * changes); external links type a URL. `rel` is not a field — it's derived in
 * resolveLink(). No class/style/data-* fields: editors pick content, not markup.
 */
export const link = defineType({
  name: "link",
  title: "Link",
  type: "object",
  icon: LinkIcon,
  fields: [
    defineField({
      name: "kind",
      title: "Type",
      type: "string",
      initialValue: "internal",
      options: {
        list: [
          { title: "Page", value: "internal" },
          { title: "External URL", value: "external" },
        ],
        layout: "radio",
        direction: "horizontal",
      },
    }),
    defineField({
      name: "page",
      title: "Page",
      type: "reference",
      to: [{ type: "page" }],
      hidden: ({ parent }) => parent?.kind === "external",
    }),
    defineField({
      name: "anchor",
      title: "Anchor",
      type: "string",
      description: 'Optional section id, e.g. "contact" → #contact. Alone, it links within this page.',
      hidden: ({ parent }) => parent?.kind === "external",
    }),
    defineField({
      name: "url",
      title: "URL",
      type: "url",
      validation: (rule) => rule.uri({ scheme: ["http", "https", "mailto", "tel"] }),
      hidden: ({ parent }) => parent?.kind !== "external",
    }),
    defineField({
      name: "newTab",
      title: "Open in new tab",
      type: "boolean",
      initialValue: false,
      hidden: ({ parent }) => parent?.kind !== "external",
    }),
  ],
});

/** A labelled link, for menus. */
export const navItem = defineType({
  name: "navItem",
  title: "Menu item",
  type: "object",
  icon: LinkIcon,
  fields: [
    defineField({ name: "label", title: "Label", type: "string", validation: (r) => r.required() }),
    defineField({ name: "link", title: "Link", type: "link" }),
  ],
  preview: { select: { title: "label" } },
});
