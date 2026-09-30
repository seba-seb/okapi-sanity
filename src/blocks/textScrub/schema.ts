import { defineField, defineType } from "sanity";
import { TextIcon } from "@sanity/icons";

/** A long statement whose words light up one by one as you scroll. */
export const textScrub = defineType({
  name: "textScrub",
  title: "Scroll Text",
  type: "object",
  icon: TextIcon,
  fields: [
    defineField({ name: "text", title: "Text", type: "text", rows: 6, validation: (r) => r.required() }),
    defineField({
      name: "size",
      title: "Size",
      type: "string",
      initialValue: "xl",
      options: { list: ["lg", "xl", "2xl", "3xl"].map((v) => ({ title: v.toUpperCase(), value: v })) },
    }),
  ],
  preview: { select: { title: "text" }, prepare: ({ title }) => ({ title, subtitle: "Scroll Text" }) },
});
