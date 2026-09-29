import { defineArrayMember, defineField, defineType } from "sanity";
import { CubeIcon } from "@sanity/icons";

import { defaultContentWrapperContent } from "../../../lib/blockDefaults";

/**
 * Groups the copy blocks (eyebrow / heading / paragraph / button group) into one
 * prose stack with a clean, self-trimming vertical rhythm. The blocks carry
 * their own default margins; this wrapper strips the top margin off its first
 * child and the bottom margin off its last child so the stack sits flush.
 *
 * Its content is intentionally limited to those four text/button blocks — use a
 * Container to group anything else.
 */
export const contentWrapper = defineType({
  name: "contentWrapper",
  title: "Content",
  type: "object",
  icon: CubeIcon,
  fields: [
    defineField({
      name: "content",
      title: "Content",
      description: "Eyebrow, heading, paragraph, and button group blocks.",
      type: "array",
      of: [
        defineArrayMember({ type: "eyebrow" }),
        defineArrayMember({ type: "heading" }),
        defineArrayMember({ type: "paragraph" }),
        defineArrayMember({ type: "buttonWrapper" }),
      ],
      // Seed a full prose stack: eyebrow · heading · paragraph · button group.
      initialValue: defaultContentWrapperContent(),
    }),
  ],
  preview: {
    select: { content: "content" },
    prepare: ({ content }) => ({
      title: "Content",
      subtitle: `${content?.length ?? 0} block(s)`,
    }),
  },
});
