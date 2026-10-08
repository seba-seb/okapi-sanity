import { defineArrayMember, defineField, defineType } from "sanity";
import { DocumentIcon } from "@sanity/icons";

export const page = defineType({
  name: "page",
  title: "Page",
  type: "document",
  icon: DocumentIcon,
  groups: [
    { name: "content", title: "Content", default: true },
    { name: "seo", title: "SEO" },
  ],
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      group: "content",
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      group: "content",
      options: { source: "title", maxLength: 96 },
      description: 'Use "home" for the homepage.',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: "sections",
      title: "Sections",
      description: "Compose the page from sections.",
      type: "array",
      group: "content",
      of: [defineArrayMember({ type: "section" }), defineArrayMember({ type: "componentRef" })],
    }),
    // All optional, all with fallbacks (page title → Settings). A <title> is
    // not an <h1>: write it for the search result, not for the page.
    defineField({
      name: "metaTitle",
      title: "Meta title",
      type: "string",
      group: "seo",
      description: "Empty = the page title.",
      validation: (r) => r.max(60).warning("Over 60 characters gets truncated in search results."),
    }),
    defineField({
      name: "metaDescription",
      title: "Meta description",
      type: "text",
      rows: 3,
      group: "seo",
      description: "Empty = the default description in Settings.",
      validation: (r) => r.max(160).warning("Over 160 characters gets truncated."),
    }),
    defineField({
      name: "ogImage",
      title: "Social share image",
      type: "image",
      group: "seo",
      description: "1200×630. Empty = the default in Settings.",
    }),
    defineField({
      name: "noindex",
      title: "Hide from search engines",
      type: "boolean",
      group: "seo",
      initialValue: false,
      description: "Adds noindex and leaves the page out of the sitemap.",
    }),
  ],
  preview: {
    select: { title: "title", slug: "slug.current" },
    prepare: ({ title, slug }) => ({
      title: title || "Untitled page",
      subtitle: slug ? `/${slug === "home" ? "" : slug}` : "No slug",
    }),
  },
});
