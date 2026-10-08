import { defineField, defineType } from "sanity";
import { ComponentIcon } from "@sanity/icons";

/** An instance of a library component, placed among a page's sections. */
export const componentRef = defineType({
  name: "componentRef",
  title: "Component",
  type: "object",
  icon: ComponentIcon,
  fields: [defineField({ name: "component", title: "Component", type: "reference", to: [{ type: "component" }], validation: (r) => r.required() })],
  preview: { select: { title: "component.title" }, prepare: ({ title }) => ({ title: title || "Component", subtitle: "Component instance" }) },
});
