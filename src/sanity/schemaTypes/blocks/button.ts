import { defineField, defineType } from "sanity";
import { LinkIcon } from "@sanity/icons";

import { BUTTON_LABEL } from "../../../lib/blockDefaults";

export const button = defineType({
  name: "button",
  title: "Button",
  type: "object",
  icon: LinkIcon,
  fields: [
    defineField({
      name: "label",
      title: "Label",
      type: "string",
      initialValue: BUTTON_LABEL,
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "href",
      title: "Link",
      type: "string",
      description: "A URL (https://…), a path (/about), or an anchor (#section).",
    }),
    defineField({
      name: "newTab",
      title: "Open in new tab",
      type: "boolean",
      initialValue: false,
    }),
    // Dropdown: button STYLE variant.
    defineField({
      name: "style",
      title: "Style",
      type: "string",
      initialValue: "primary",
      options: {
        list: [
          { title: "Primary", value: "primary" },
          { title: "Secondary", value: "secondary" },
          { title: "Outline", value: "outline" },
          { title: "Link", value: "link" },
        ],
        layout: "dropdown",
      },
    }),
    defineField({
      name: "fullWidth",
      title: "Full width",
      type: "boolean",
      initialValue: false,
    }),
  ],
  preview: {
    select: { title: "label", style: "style" },
    prepare: ({ title, style }) => ({
      title: title || "Button",
      subtitle: `Button · ${style ?? "primary"}`,
    }),
  },
});
