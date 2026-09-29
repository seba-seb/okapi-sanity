import { defineQuery } from "groq";

// A page and everything inside it. Nested block arrays (grid items, slider
// slides, card content, button groups) are returned inline by the default
// projection, which is exactly what the recursive renderer needs.
export const PAGE_QUERY = defineQuery(
  `*[_type == "page" && slug.current == $slug][0]`,
);

export const PAGES_SLUGS_QUERY = defineQuery(
  `*[_type == "page" && defined(slug.current)]{ "slug": slug.current }`,
);

export const PAGE_META_QUERY = defineQuery(
  `*[_type == "page" && slug.current == $slug][0]{
    title, metaTitle, metaDescription, ogImage
  }`,
);

/** Page id → slug, for resolving internal links. */
export const ROUTES_QUERY = defineQuery(
  `*[_type == "page" && defined(slug.current)]{ _id, "slug": slug.current }`,
);

export const SETTINGS_QUERY = defineQuery(`*[_id == "settings"][0]`);

export const NAVIGATION_QUERY = defineQuery(`*[_id == "navigation"][0]`);
