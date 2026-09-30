import { defineField, defineType } from "sanity";
import { StackIcon } from "@sanity/icons";

import { membersFor } from "@/blocks/_shared/members";

/** Cards that stick and stack; each one shrinks back as the next arrives. */
export const stackCards = defineType({
  name: "stackCards",
  title: "Stacked Cards",
  type: "object",
  icon: StackIcon,
  fields: [defineField({ name: "items", title: "Cards", type: "array", of: membersFor("stackCards") })],
  preview: {
    select: { items: "items" },
    prepare: ({ items }) => ({ title: "Stacked Cards", subtitle: `${items?.length ?? 0} cards` }),
  },
});
