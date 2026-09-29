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

import { apiVersion, dataset, projectId, studioUrl } from "./src/sanity/env";
import { schemaTypes } from "./src/sanity/schemaTypes";
import { structure } from "./src/sanity/structure";
import { resolve } from "./src/sanity/presentation";
import { PreviewSelect } from "./src/sanity/components/PreviewSelect";
import { TooltipDescriptionField } from "./src/sanity/components/TooltipDescriptionField";
import { CanvasResizeListener } from "./src/sanity/components/CanvasResizeListener";
import { EditorKeyForwarder } from "./src/sanity/components/EditorKeyForwarder";
import { CanvasAutofocusGuard } from "./src/sanity/components/CanvasAutofocusGuard";

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
  basePath: studioUrl,
  projectId,
  dataset,
  schema: {
    types: schemaTypes,
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
  plugins: [
    structureTool({ structure }),
    presentationTool({
      resolve,
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
