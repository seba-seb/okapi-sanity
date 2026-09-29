import { defineField, defineType } from "sanity";

import {
  ptToPlain,
  richTextField,
  sliderField,
  spacingField,
  textWrapField,
} from "../shared/fields";
import { CH_MAX_WIDTH } from "../../../lib/maxWidth";
import { HEADING_TEXT } from "../../../lib/blockDefaults";

export const heading = defineType({
  name: "heading",
  title: "Heading",
  type: "object",
  fields: [
    richTextField({ initialText: HEADING_TEXT }),
    defineField({
      name: "level",
      title: "Semantic level",
      type: "string",
      description: "The HTML tag used (for SEO / accessibility).",
      initialValue: "h2",
      options: {
        list: ["h1", "h2", "h3", "h4", "h5", "h6"].map((v) => ({
          title: v.toUpperCase(),
          value: v,
        })),
        layout: "dropdown",
      },
    }),
    defineField({
      name: "size",
      title: "Visual size",
      type: "string",
      description: "Hover to preview, click to set.",
      initialValue: "xl",
      options: {
        list: [
          { title: "Small", value: "sm" },
          { title: "Medium", value: "md" },
          { title: "Large", value: "lg" },
          { title: "XL", value: "xl" },
          { title: "2XL", value: "2xl" },
          { title: "3XL", value: "3xl" },
          { title: "4XL — Display", value: "4xl" },
        ],
      },
    }),
    textWrapField("balance"),
    // Drag to adjust the max width — "Auto" means full container width.
    // Measured in `ch` (character width). Also draggable on the canvas.
    sliderField({
      name: "maxWidth",
      title: "Max width",
      description:
        "Constrain the line length, measured in characters (ch). Drag the handle on the canvas too. Auto = full width.",
      min: CH_MAX_WIDTH.heading.min,
      max: CH_MAX_WIDTH.heading.max,
      step: CH_MAX_WIDTH.heading.step,
      suffix: "ch",
      allowUnset: true,
      unsetLabel: "Auto",
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
    select: { title: "text", size: "size", level: "level" },
    prepare: ({ title, size, level }) => ({
      title: ptToPlain(title) || "Heading",
      subtitle: `Heading · ${level ?? "h2"} · ${size ?? "xl"}`,
    }),
  },
});
