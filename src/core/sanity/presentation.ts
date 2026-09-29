import {
  defineDocuments,
  defineLocations,
  type PresentationPluginOptions,
} from "sanity/presentation";

import { previewPrefix } from "@/core/sanity/env";

/**
 * Maps documents to the preview URLs (the /preview mirror of the public
 * routes) where they appear, so the Presentation
 * tool knows what to render and where the click-to-edit overlays live.
 */
export const resolve: PresentationPluginOptions["resolve"] = {
  // URL → document. This is the reverse of `locations`: it lets Presentation
  // figure out which document the previewed URL represents. Without it, a page
  // you navigate to (e.g. a brand-new, still-empty /about with nothing to
  // click) can't be opened for editing — Presentation doesn't know /about is
  // the About document. The route params bind to the GROQ `$` params.
  mainDocuments: defineDocuments([
    {
      route: previewPrefix,
      filter: `_type == "page" && slug.current == "home"`,
    },
    {
      route: `${previewPrefix}/:slug`,
      filter: `_type == "page" && slug.current == $slug`,
    },
  ]),
  locations: {
    page: defineLocations({
      select: { title: "title", slug: "slug.current" },
      resolve: (doc) => {
        const slug = doc?.slug;
        const isHome = slug === "home";
        const href = isHome ? previewPrefix : `${previewPrefix}/${slug ?? ""}`;

        // Keep hrefs unique — Sanity keys the "Documents on this page" list by
        // href, so a duplicate "/" makes that panel glitch on every edit.
        const locations = [{ title: doc?.title || "Untitled", href }];
        if (!isHome) {
          locations.push({ title: "Home", href: previewPrefix });
        }
        return { locations };
      },
    }),
  },
};
