import { defineField, defineType } from "sanity";
import { TextIcon } from "@sanity/icons";

/** Oversized display type; its letters move with the scroll. */
export const bigType = defineType({
  name: "bigType",
  title: "Big Type",
  type: "object",
  icon: TextIcon,
  fields: [
    defineField({ name: "text", title: "Text", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "effect",
      title: "Effect",
      type: "string",
      initialValue: "rise",
      options: {
        list: [
          { title: "Letters rise", value: "rise" },
          { title: "Wave", value: "wave" },
          { title: "Spread", value: "spread" },
        ],
      },
    }),
  ],
  preview: { select: { title: "text" }, prepare: ({ title }) => ({ title, subtitle: "Big Type" }) },
});
