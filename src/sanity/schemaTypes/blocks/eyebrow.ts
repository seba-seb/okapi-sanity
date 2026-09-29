import { defineField, defineType } from "sanity";

import { spacingField } from "../shared/fields";
import { EYEBROW_TEXT } from "../../../lib/blockDefaults";

export const eyebrow = defineType({
  name: "eyebrow",
  title: "Eyebrow",
  type: "object",
  fields: [
    defineField({
      name: "text",
      title: "Text",
      type: "string",
      initialValue: EYEBROW_TEXT,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "size",
      title: "Size",
      type: "string",
      initialValue: "sm",
      options: {
        list: [
          { title: "Extra small", value: "xs" },
          { title: "Small", value: "sm" },
          { title: "Medium", value: "md" },
        ],
        layout: "radio",
        direction: "horizontal",
      },
    }),
    defineField({
      name: "color",
      title: "Color",
      type: "string",
      initialValue: "brand",
      description: "Follows the section theme.",
      options: {
        list: [
          { title: "Brand", value: "brand" },
          { title: "Default", value: "default" },
          { title: "Muted", value: "muted" },
        ],
        layout: "radio",
        direction: "horizontal",
      },
    }),
    // Drag the handle at the block's bottom edge on the canvas, or pick here.
    // Unset keeps the default rhythm (see AlignBlock `space`).
    spacingField({
      name: "marginBottom",
      title: "Bottom margin",
      description: "Space below this block, from the spacing scale.",
    }),
  ],
  preview: {
    select: { title: "text" },
    prepare: ({ title }) => ({
      title: title || "Eyebrow",
      subtitle: "Eyebrow",
    }),
  },
});
