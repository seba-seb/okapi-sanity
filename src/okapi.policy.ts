import type { Policy } from "@/core/editor/policy";

/**
 * WHO CAN DO WHAT in the Okapi Editor — decided by the agency, per project.
 *
 * Keys are Sanity role names (sanity.io/manage → Members); `default` covers any
 * other role. The AI chat acts with the grant of the person using it, so it can
 * never do more than they could by hand.
 *
 * Permissions: text · images · style · settings · reorder · structure ·
 * components · publish · chat   (meaning of each: core/editor/policy.ts)
 * `blocks`: the block types a role may add (with `structure`); omit = all.
 */
export const POLICY: Policy = {
  administrator: {
    label: "Administrator",
    can: ["text", "images", "style", "settings", "reorder", "structure", "components", "publish", "chat"],
  },
  editor: {
    label: "Editor",
    can: ["text", "images", "reorder", "structure", "publish", "chat"],
    blocks: ["section", "eyebrow", "heading", "paragraph", "buttonWrapper", "button", "imageBlock", "card", "contentWrapper", "grid"],
  },
  contributor: {
    label: "Contributor",
    // No "chat" by default: every message costs the project. Add it if the agency wants.
    can: ["text", "images", "reorder"],
  },
  default: {
    label: "Viewer",
    can: [],
  },
};
