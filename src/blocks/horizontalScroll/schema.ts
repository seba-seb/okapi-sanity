import { defineField, defineType } from "sanity";
import { ArrowRightIcon } from "@sanity/icons";

import { membersFor } from "@/blocks/_shared/members";
import { sliderField } from "@/blocks/_shared/fields";

/** A pinned band whose items travel sideways as you scroll down. */
export const horizontalScroll = defineType({
  name: "horizontalScroll",
  title: "Horizontal Scroll",
  type: "object",
  icon: ArrowRightIcon,
  fields: [
    defineField({ name: "heading", title: "Heading", type: "string" }),
    defineField({ name: "items", title: "Items", type: "array", of: membersFor("horizontalScroll") }),
    sliderField({
      name: "panelWidth",
      title: "Item width",
      description: "Width of each item, in % of the screen width.",
      min: 25,
      max: 90,
      step: 5,
      suffix: "vw",
      initialValue: 45,
    }),
  ],
  preview: {
    select: { title: "heading", items: "items" },
    prepare: ({ title, items }) => ({
      title: title || "Horizontal Scroll",
      subtitle: `${items?.length ?? 0} items`,
    }),
  },
});
