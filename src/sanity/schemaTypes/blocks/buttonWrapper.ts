import { defineArrayMember, defineField, defineType } from "sanity";

import { spacingField } from "../shared/fields";
import { defaultButton } from "../../../lib/blockDefaults";
import { ButtonsArrayInput } from "../../components/ButtonsArrayInput";

export const buttonWrapper = defineType({
  name: "buttonWrapper",
  title: "Button Group",
  type: "object",
  fields: [
    defineField({
      name: "buttons",
      title: "Buttons",
      type: "array",
      of: [defineArrayMember({ type: "button" })],
      // Start with one primary button; the 2nd+ added defaults to outline.
      initialValue: [defaultButton()],
      components: { input: ButtonsArrayInput },
      validation: (rule) => rule.min(1),
    }),
    defineField({
      name: "direction",
      title: "Direction",
      type: "string",
      initialValue: "row",
      options: {
        list: [
          { title: "Row", value: "row" },
          { title: "Column", value: "column" },
        ],
        layout: "radio",
        direction: "horizontal",
      },
    }),
    // Size applies to EVERY button in the group (cascades via --btn-font-size).
    defineField({
      name: "size",
      title: "Size",
      type: "string",
      initialValue: "md",
      options: {
        list: [
          { title: "Small", value: "sm" },
          { title: "Medium", value: "md" },
          { title: "Large", value: "lg" },
          { title: "X-Large", value: "xl" },
        ],
      },
    }),
    defineField({
      name: "wrap",
      title: "Wrap to new line",
      type: "boolean",
      initialValue: true,
    }),
    spacingField({
      name: "gap",
      title: "Gap",
      description: "Space between buttons, from the spacing scale.",
      initialValue: "sm",
    }),
    spacingField({
      name: "marginTop",
      title: "Top margin",
      description: "Space above the group, from the spacing scale.",
      initialValue: "lg",
    }),
  ],
  preview: {
    select: { buttons: "buttons" },
    prepare: ({ buttons }) => ({
      title: "Button Group",
      subtitle: `${buttons?.length ?? 0} button(s)`,
    }),
  },
});
