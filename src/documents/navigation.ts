import { defineField, defineType } from "sanity";
import { MenuIcon } from "@sanity/icons/Menu";

/** Singleton (id "navigation"): header and footer menus. */
export const navigation = defineType({
  name: "navigation",
  title: "Navigation",
  type: "document",
  icon: MenuIcon,
  fields: [
    defineField({ name: "header", title: "Header", type: "array", of: [{ type: "navItem" }] }),
    defineField({ name: "footer", title: "Footer", type: "array", of: [{ type: "navItem" }] }),
  ],
  preview: { prepare: () => ({ title: "Navigation" }) },
});
