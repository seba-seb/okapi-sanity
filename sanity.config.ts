import { createElement, Fragment } from "react";
import {
  defineConfig,
  type FieldProps,
  type InputProps,
  type LayoutProps,
  type StringInputProps,
} from "sanity";
import { structureTool } from "sanity/structure";
import { buildTheme } from "@sanity/themer";

import { dataset, projectId } from "./src/core/sanity/env";
import { schemaTypes, SINGLETONS } from "./src/schema";
import { structure } from "./src/core/sanity/structure";
import { EditorTool } from "./src/core/editor/EditorTool";
import { installStaleChunkReload } from "./src/core/lib/staleChunkReload";

installStaleChunkReload();
import { EditIcon } from "@sanity/icons";
import { PreviewSelect } from "./src/core/studio/PreviewSelect";
import { TooltipDescriptionField } from "./src/core/studio/TooltipDescriptionField";
import { STUDIO_ACCENT, STUDIO_BG_DARK } from "./src/theme/studio";

// Studio theme via Sanity's official @sanity/themer (stable buildTheme API, pinned).
// Only accent + backgrounds: everything else falls back to the stock Studio colours.
const theme = buildTheme({
  light: { accent: STUDIO_ACCENT },
  dark: { accent: STUDIO_ACCENT, background: STUDIO_BG_DARK },
});

/**
 * Renders enum string fields (those with an `options.list`) as segmented
 * buttons (`PreviewSelect`).
 * Every other input falls through to Sanity's default.
 */
function inputComponent(props: InputProps) {
  const schemaType = props.schemaType as {
    jsonType?: string;
    options?: { list?: unknown };
    components?: { input?: unknown };
  };
  // A field that declares its own input (e.g. the logo colour / shape pickers)
  // wins — render it via renderDefault instead of the generic PreviewSelect.
  if (schemaType.components?.input) {
    return props.renderDefault(props);
  }
  if (
    schemaType.jsonType === "string" &&
    Array.isArray(schemaType.options?.list) &&
    schemaType.options.list.length > 0
  ) {
    return createElement(PreviewSelect, props as StringInputProps);
  }
  return props.renderDefault(props);
}

/**
 * Shows a leaf field's `description` as a hover tooltip (an info icon beside the
 * title) instead of a paragraph under the label — so the compact button/slider/
 * dropdown controls stay tight. Objects/arrays and fields with no description
 * keep Sanity's default rendering.
 */
function fieldComponent(props: FieldProps) {
  const jsonType = (props.schemaType as { jsonType?: string }).jsonType;
  // Only the segmented / slider / dropdown controls (string & number). Booleans
  // render inline with their label, and objects/arrays have their own headers —
  // leave those alone.
  const isControl = jsonType === "string" || jsonType === "number";
  if (isControl && props.description) {
    return createElement(TooltipDescriptionField, props);
  }
  return props.renderDefault(props);
}

// Sanity UI sets its font on its own components only; the page root stays at
// the browser default (Times), so any plain HTML in custom tools and panels
// (Editor, page navigator) rendered serif. Give the root Sanity's stack.
const STUDIO_FONT = `[data-ui="AstroStudioLayout"] { font-family: Inter, -apple-system, "system-ui", "Segoe UI", Roboto, "Helvetica Neue", "Liberation Sans", Helvetica, Arial, system-ui, sans-serif; }`;

function studioLayout(props: LayoutProps) {
  return createElement(
    Fragment,
    null,
    createElement("style", null, STUDIO_FONT),
    props.renderDefault(props),
  );
}

export default defineConfig({
  name: "default",
  title: "Okapi",
  theme,
  // The Studio is served at /studio (astro.config studioBasePath) with HASH
  // routing, so the workspace lives at the root of the hash: #/editor,
  // #/structure. With "/studio" here the hash had to be #/studio/…, and
  // any other hash — #/, or the empty one left after Brave's cookieless
  // login consumes #sid=… — matched no workspace and rendered a blank page.
  basePath: "/",
  projectId,
  dataset,
  // Token login (stored in this browser) instead of cookies: the editor chat
  // sends the session token to the site's own /api/editor-chat, which checks it
  // with Sanity. Cookies for api.sanity.io never reach the site's domain.
  auth: { loginMethod: "token" },
  schema: {
    types: schemaTypes,
    // Singletons can't be created from the "+" menu…
    templates: (templates) =>
      templates.filter((t) => !(SINGLETONS as readonly string[]).includes(t.schemaType)),
  },
  document: {
    // …nor deleted or duplicated.
    actions: (actions, { schemaType }) =>
      (SINGLETONS as readonly string[]).includes(schemaType)
        ? actions.filter((a) => !["delete", "duplicate", "unpublish"].includes(a.action ?? ""))
        : actions,
  },
  form: {
    components: {
      input: inputComponent,
      field: fieldComponent,
    },
  },
  studio: {
    components: {
      layout: studioLayout,
    },
  },
  // Okapi Editor first, so it's the Studio's landing tool.
  tools: (prev) => [{ name: "editor", title: "Editor", icon: EditIcon, component: EditorTool }, ...prev],
  plugins: [
    structureTool({ structure }),
  ],
});
