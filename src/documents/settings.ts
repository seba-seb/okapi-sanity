import { defineField, defineType } from "sanity";
import { CogIcon } from "@sanity/icons";

/** Singleton (id "settings"): site-wide defaults every page falls back to. */
export const settings = defineType({
  name: "settings",
  title: "Settings",
  type: "document",
  icon: CogIcon,
  fields: [
    defineField({
      name: "siteName",
      title: "Site name",
      type: "string",
      description: "Appended to every page title: “About · Site name”.",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "description",
      title: "Default description",
      type: "text",
      rows: 3,
      description: "Used when a page has no meta description.",
      validation: (r) => r.max(160).warning("Over 160 characters gets truncated."),
    }),
    defineField({
      name: "ogImage",
      title: "Default social image",
      type: "image",
      description: "1200×630. Used when a page has no social image of its own.",
    }),
    defineField({
      name: "socialLinks",
      title: "Social links",
      type: "array",
      of: [{ type: "navItem" }],
    }),
  ],
  preview: { prepare: () => ({ title: "Settings" }) },
});
