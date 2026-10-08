import { createElement, Fragment } from "react";
import {
  defineConfig,
  type FieldProps,
  type InputProps,
  type LayoutProps,
  type StringInputProps,
} from "sanity";
import { structureTool } from "sanity/structure";
import { presentationTool } from "sanity/presentation";
import { visionTool } from "@sanity/vision";

import { apiVersion, dataset, projectId } from "./src/core/sanity/env";
import { schemaTypes, SINGLETONS } from "./src/schema";
import { structure } from "./src/core/sanity/structure";
import { resolve } from "./src/core/sanity/presentation";
import { PageNavigator } from "./src/core/studio/PageNavigator";
import { EditorTool } from "./src/core/editor/EditorTool";
import { EditIcon } from "@sanity/icons";
import { PreviewSelect } from "./src/core/studio/PreviewSelect";
import { TooltipDescriptionField } from "./src/core/studio/TooltipDescriptionField";
import { CanvasResizeListener } from "./src/core/studio/CanvasResizeListener";
import { EditorKeyForwarder } from "./src/core/studio/EditorKeyForwarder";
import { CanvasAutofocusGuard } from "./src/core/studio/CanvasAutofocusGuard";

/**
 * Renders enum string fields (those with an `options.list`) with the hoverable
 * `PreviewSelect` so editors can live-preview each option in Presentation.
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

/**
 * Wraps the whole Studio so the Presentation-preview listeners are always
 * mounted: `CanvasResizeListener` receives drag-to-resize commits and patches
 * the draft, `EditorKeyForwarder` relays block shortcuts (delete / duplicate /
 * copy / paste) pressed while focus is in the Studio to the preview, and
 * `CanvasAutofocusGuard` suppresses the click-to-edit autofocus (keeping the
 * pane navigation) so keyboard focus stays on the canvas.
 * See the matching `CanvasResizer` / `EditorShortcuts` components on the front
 * end.
 */
function studioLayout(props: LayoutProps) {
  return createElement(
    Fragment,
    null,
    props.renderDefault(props),
    createElement(CanvasResizeListener),
    createElement(EditorKeyForwarder),
    createElement(CanvasAutofocusGuard),
  );
}

export default defineConfig({
  name: "default",
  title: "Remarkable",
  // The Studio is served at /studio (astro.config studioBasePath) with HASH
  // routing, so the workspace lives at the root of the hash: #/structure,
  // #/presentation. With "/studio" here the hash had to be #/studio/…, and
  // any other hash — #/, or the empty one left after Brave's cookieless
  // login consumes #sid=… — matched no workspace and rendered a blank page.
  basePath: "/",
  projectId,
  dataset,
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
  // Remarkable Editor first, so it's the Studio's landing tool.
  tools: (prev) => [{ name: "editor", title: "Editor", icon: EditIcon, component: EditorTool }, ...prev],
  plugins: [
    structureTool({ structure }),
    presentationTool({
      resolve,
      // Page picker in the side panel. `unstable_navigator` lives under
      // `components` in sanity@6 (not top-level `navigator`).
      components: {
        unstable_navigator: { component: PageNavigator, minWidth: 200, maxWidth: 320 },
      },
      previewUrl: {
        // Relative: the Studio is embedded, so its origin IS the site.
        initial: "/preview",
        previewMode: {
          enable: "/api/draft-mode/enable",
        },
      },
    }),
    visionTool({ defaultApiVersion: apiVersion }),
  ],
});
