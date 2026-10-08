import { defineArrayMember, defineField, defineType } from "sanity";
import { ComponentIcon, LinkIcon } from "@sanity/icons";

/**
 * An instance of a library component, placed among a page's sections.
 * `overrides` = per-instance content (like Webflow component props): each one
 * replaces one field of one block inside the component — `target` is
 * "<blockKey>.<field>". Set them by editing text / dropping images inside the
 * instance on the canvas; the master stays untouched.
 */
export const componentRef = defineType({
  name: "componentRef",
  title: "Component",
  type: "object",
  icon: ComponentIcon,
  fields: [
    defineField({ name: "component", title: "Component", type: "reference", to: [{ type: "component" }], validation: (r) => r.required() }),
    defineField({
      name: "overrides",
      title: "Overrides",
      type: "array",
      of: [
        defineArrayMember({
          name: "componentOverride",
          title: "Override",
          type: "object",
          fields: [
            defineField({ name: "target", title: "Target", type: "string", readOnly: true }),
            defineField({ name: "text", title: "Text", type: "text", rows: 2 }),
            defineField({
              name: "rich",
              title: "Rich text",
              type: "array",
              of: [
                defineArrayMember({
                  type: "block",
                  styles: [{ title: "Normal", value: "normal" }],
                  lists: [],
                  marks: {
                    decorators: [
                      { title: "Bold", value: "strong" },
                      { title: "Italic", value: "em" },
                    ],
                    annotations: [defineArrayMember({ name: "link", type: "link", title: "Link", icon: LinkIcon })],
                  },
                }),
              ],
            }),
            defineField({ name: "image", title: "Image", type: "image", options: { hotspot: true } }),
          ],
          preview: { select: { title: "target", subtitle: "text" } },
        }),
      ],
    }),
  ],
  preview: { select: { title: "component.title" }, prepare: ({ title }) => ({ title: title || "Component", subtitle: "Component instance" }) },
});
