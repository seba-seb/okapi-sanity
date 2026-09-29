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
      of: [defineArrayMember({ type: "section" })],
    }),
    defineField({
      name: "metaTitle",
      title: "Meta title",
      type: "string",
      group: "seo",
    }),
    defineField({
      name: "metaDescription",
      title: "Meta description",
      type: "text",
      rows: 3,
      group: "seo",
    }),
    defineField({
      name: "ogImage",
      title: "Social share image",
      type: "image",
      group: "seo",
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
