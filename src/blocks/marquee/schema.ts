import { defineArrayMember, defineField, defineType } from "sanity";
import { TransferIcon } from "@sanity/icons";

import { sliderField } from "@/blocks/_shared/fields";

export const marquee = defineType({
  name: "marquee",
  title: "Marquee",
  type: "object",
  icon: TransferIcon,
  fields: [
    defineField({
      name: "items",
      title: "Words",
      type: "array",
      of: [defineArrayMember({ type: "string" })],
      validation: (r) => r.min(1),
    }),
    defineField({ name: "separator", title: "Separator", type: "string", initialValue: "✦" }),
    defineField({
      name: "direction",
      title: "Direction",
      type: "string",
      initialValue: "left",
      options: { list: [{ title: "Left", value: "left" }, { title: "Right", value: "right" }] },
    }),
    sliderField({
      name: "duration",
      title: "Loop duration",
      description: "Seconds per loop. Scrolling speeds it up.",
      min: 8,
      max: 60,
      step: 2,
      suffix: "s",
      initialValue: 24,
    }),
    defineField({
      name: "outline",
      title: "Outlined text",
      type: "boolean",
      initialValue: false,
    }),
  ],
  preview: {
    select: { items: "items" },
    prepare: ({ items }) => ({ title: (items ?? []).join(" · ") || "Marquee", subtitle: "Marquee" }),
  },
});
