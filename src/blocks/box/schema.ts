import { defineField, defineType } from "sanity";
import { BlockContentIcon } from "@sanity/icons/BlockContent";

import { membersFor } from "@/blocks/_shared/members";
import { sliderField } from "@/blocks/_shared/fields";
import { SPACE } from "@/core/style/tokens";

const list = (values: readonly string[]) => ({ list: values.map((v) => ({ title: v, value: v })) });

/** A free layout container: stack, row or grid of any blocks (boxes nest). */
export const box = defineType({
  name: "box",
  title: "Box",
  type: "object",
  icon: BlockContentIcon,
  fields: [
    defineField({ name: "name", title: "Name", type: "string", description: "Only shown in the editor's layers." }),
    defineField({
      name: "layout",
      title: "Layout",
      type: "string",
      initialValue: "stack",
      options: { list: [{ title: "Stack", value: "stack" }, { title: "Row", value: "row" }, { title: "Grid", value: "grid" }] },
    }),
    sliderField({ name: "columns", title: "Columns", min: 1, max: 6, step: 1, initialValue: 3, hidden: ({ parent }) => parent?.layout !== "grid" }),
    defineField({ name: "gap", title: "Gap", type: "string", initialValue: "md", options: list(SPACE) }),
    defineField({ name: "align", title: "Align items", type: "string", options: list(["start", "center", "end", "stretch"]) }),
    defineField({
      name: "justify",
      title: "Justify",
      type: "string",
      options: list(["start", "center", "end", "between"]),
      hidden: ({ parent }) => parent?.layout === "grid",
    }),
    defineField({ name: "wrap", title: "Wrap", type: "boolean", initialValue: true, hidden: ({ parent }) => parent?.layout !== "row" }),
    defineField({ name: "items", title: "Items", type: "array", of: membersFor("box") }),
  ],
  preview: {
    select: { name: "name", layout: "layout", items: "items" },
    prepare: ({ name, layout, items }) => ({ title: name || "Box", subtitle: `${layout ?? "stack"} · ${items?.length ?? 0} items` }),
  },
});
