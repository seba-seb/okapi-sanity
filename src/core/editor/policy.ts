/**
 * What a person may do in the Okapi Editor, by hand and through the chat.
 * The project decides per Sanity role in `src/okapi.policy.ts`; the chat
 * gets exactly the grant of the person using it, never more.
 *
 * This shapes the editor UI and validates every chat change. The hard
 * boundary is still the person's Sanity role (what the API lets them write).
 */
export const PERMISSIONS = {
  text: "Edit texts, rich text and links",
  images: "Replace images",
  style: "Style panel (tokens: spacing, colors, radius, width)",
  settings: "Block settings (variants, sizes, layout, animation)",
  reorder: "Move blocks up and down",
  structure: "Add, duplicate and delete blocks",
  components: "Make, detach and insert library components",
  publish: "Publish",
  chat: "Use the AI chat",
} as const;
export type Permission = keyof typeof PERMISSIONS;

export type RolePolicy = {
  /** Shown in the editor ("View as"). */
  label: string;
  can: readonly Permission[];
  /** Block types this role may add (with `structure`). Omit = every type. */
  blocks?: readonly string[];
};
/** Keys are Sanity role names (administrator, editor, contributor…); `default` covers the rest. */
export type Policy = { default: RolePolicy } & Record<string, RolePolicy>;

export type Grant = { role: string; label: string; can: ReadonlySet<Permission>; blocks: readonly string[] | null };

/** The grant for a user with these Sanity roles: the union of every role the policy names. */
export function grantFor(roles: readonly string[], policy: Policy): Grant {
  const matched = roles.filter((r) => r !== "default" && policy[r]);
  const rules = matched.length ? matched.map((r) => policy[r]) : [policy.default];
  const anyAllBlocks = rules.some((r) => r.can.includes("structure") && !r.blocks);
  return {
    role: matched[0] ?? "default",
    label: rules.map((r) => r.label).join(" + "),
    can: new Set(rules.flatMap((r) => r.can)),
    blocks: anyAllBlocks ? null : [...new Set(rules.flatMap((r) => r.blocks ?? []))],
  };
}

export const may = (g: Grant, p: Permission) => g.can.has(p);
export const mayAdd = (g: Grant, type: string) =>
  g.can.has("structure") && (type !== "componentRef" || g.can.has("components")) && (!g.blocks || g.blocks.includes(type));
export const mayReorder = (g: Grant) => g.can.has("reorder") || g.can.has("structure");

/** Which permission a block field falls under (see FieldControls.fieldKind). */
export type FieldKind = "text" | "images" | "style" | "settings";
