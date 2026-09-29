import { defineField, defineType } from "sanity";
import { BlockContentIcon } from "@sanity/icons";

import {
  ptToPlain,
  richTextField,
  sliderField,
  spacingField,
  textWrapField,
} from "../shared/fields";
import {
  CH_MAX_WIDTH,
  PARAGRAPH_MAX_WIDTH_DEFAULT,
} from "../../../lib/maxWidth";
import { PARAGRAPH_TEXT } from "../../../lib/blockDefaults";

export const paragraph = defineType({
  name: "paragraph",
  title: "Paragraph",
  type: "object",
  icon: BlockContentIcon,
  fields: [
    richTextField({ initialText: PARAGRAPH_TEXT }),
    defineField({
      name: "size",
      title: "Size",
      type: "string",
      description: "Hover to preview, click to set.",
      initialValue: "md",
      options: {
        list: [
          { title: "Small", value: "sm" },
          { title: "Medium", value: "md" },
          { title: "Large", value: "lg" },
          { title: "XL", value: "xl" },
        ],
      },
    }),
    defineField({
      name: "color",
      title: "Color",
      type: "string",
      initialValue: "muted",
      options: {
        list: [
          { title: "Default", value: "default" },
          { title: "Muted", value: "muted" },
          { title: "Brand", value: "brand" },
        ],
        layout: "radio",
        direction: "horizontal",
      },
    }),
    textWrapField("pretty"),
    // Drag to adjust the max width — "Auto" means full container width.
    // Measured in `ch` (character width). Also draggable on the canvas.
    sliderField({
      name: "maxWidth",
      title: "Max width",
      description:
        "Constrain the line length, measured in characters (ch). Drag the handle on the canvas too. Auto = full width.",
      min: CH_MAX_WIDTH.paragraph.min,
      max: CH_MAX_WIDTH.paragraph.max,
      step: CH_MAX_WIDTH.paragraph.step,
      suffix: "ch",
      allowUnset: true,
      unsetLabel: "Auto",
      initialValue: PARAGRAPH_MAX_WIDTH_DEFAULT,
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
      title: ptToPlain(title) || "Paragraph",
      subtitle: "Paragraph",
    }),
  },
});
