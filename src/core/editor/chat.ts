/**
 * The AI chat of the Remarkable Editor, as pure functions:
 *   page + grant → instruction for the model → JSON ops → validated, applied doc.
 *
 * The model never writes to Sanity. It proposes ops; `applyOps` checks each one
 * against the person's grant (src/remarkable.policy.ts), the block registry and
 * the schema (field types, allowed values), and the editor applies the result
 * as ONE undo step, saved as a draft like any manual edit.
 */
import { resolveSelection } from "@/core/editor/paths";
import { blockMeta } from "@/blocks/meta";
import { ALIGN, COLORS, RADII, SPACE, WIDTHS } from "@/core/style/tokens";
import type { Block } from "@/core/lib/types";
import { canPlace, duplicate, insert, insertTarget, layers, newBlock, nudge, remove, setAt, type Doc, type LayerNode } from "./ops";
import { may, mayAdd, mayReorder, PERMISSIONS, type FieldKind, type Grant } from "./policy";
import { plainToPt } from "./text";

// ── Catalog: what each block type's fields are (built from the Studio schema) ──

export type FieldControl = "pt" | "text" | "textarea" | "lines" | "choice" | "number" | "boolean" | "link" | "image" | "reference" | "object";
export type CatalogField = { kind: FieldKind; control: FieldControl; title: string; options?: string[] };
export type Catalog = Record<string, { title: string; fields: Record<string, CatalogField> }>;

const STYLE_PROPS: Record<string, readonly string[] | "boolean"> = {
  marginTop: SPACE,
  marginBottom: SPACE,
  padding: SPACE,
  background: COLORS,
  color: COLORS,
  radius: RADII,
  maxWidth: Object.keys(WIDTHS),
  textAlign: ALIGN,
  hide: "boolean",
};
const BREAKPOINTS = ["base", "tablet", "mobile"] as const;

// ── Ops the model may return ──

export type Op =
  | { op: "set"; path: string; field: string; value: unknown }
  | { op: "style"; path: string; prop: string; value: unknown; breakpoint?: string }
  | { op: "insert"; type: string; after?: string | null; into?: string | null; fields?: Record<string, unknown> }
  | { op: "remove"; path: string }
  | { op: "duplicate"; path: string }
  | { op: "move"; path: string; direction: "up" | "down" };

export type ChatTurn = { role: "user" | "assistant"; text: string };
/** An image attached in the chat: uploaded to Sanity by the browser, referenced by id in ops. */
export type Attachment = { id: string; name: string };
/** Attachment id → the image field value it becomes ({ _type: "image", asset: { _ref } }). */
export type AttachedImages = Record<string, unknown>;
export type PageRef = { id: string; slug?: string; title?: string };

const clip = (s: string, n = 160) => (s.length > n ? `${s.slice(0, n)}…` : s);
const ptText = (v: unknown): string =>
  Array.isArray(v)
    ? (v as { children?: { text?: string }[] }[]).map((b) => (b.children ?? []).map((c) => c.text ?? "").join("")).join("\n")
    : typeof v === "string"
      ? v
      : "";

function valueForPrompt(f: CatalogField, v: unknown): string | null {
  if (v === undefined || v === null || v === "") return null;
  if (f.control === "pt") return JSON.stringify(clip(ptText(v)));
  if (f.control === "lines") return JSON.stringify((v as string[]).map((x) => clip(x, 60)));
  if (f.control === "link") {
    const l = v as { kind?: string; url?: string; page?: { _ref?: string } };
    return l.kind === "internal" ? `{page:"${l.page?._ref ?? ""}"}` : l.url ? `{url:"${l.url}"}` : null;
  }
  if (f.control === "image") return "(image)";
  if (f.control === "object" || f.control === "reference") return null;
  return JSON.stringify(typeof v === "string" ? clip(v) : v);
}

/** The page as the model sees it: one line per block, only the fields this grant may change. */
export function describePage(doc: Doc, catalog: Catalog, grant: Grant): string {
  const lines: string[] = [];
  const walk = (nodes: LayerNode[], depth: number) => {
    for (const n of nodes) {
      const item = resolveSelection(doc, n.path)?.item as Record<string, unknown> | undefined;
      const fields = catalog[n.type]?.fields ?? {};
      const vals = Object.entries(fields)
        .filter(([, f]) => may(grant, f.kind) && f.kind !== "style")
        .map(([name, f]) => [name, valueForPrompt(f, item?.[name])] as const)
        .filter(([, v]) => v !== null)
        .map(([name, v]) => `${name}: ${v}`);
      const name = typeof item?.name === "string" && item.name ? ` "${item.name}"` : "";
      lines.push(`${"  ".repeat(depth)}${n.path} ${n.type}${name}${vals.length ? ` {${vals.join(", ")}}` : ""}`);
      walk(n.children, depth + 1);
    }
  };
  walk(layers(doc), 0);
  return lines.join("\n") || "(empty page)";
}

/** Editable fields per block type, for the types on the page and the ones this grant may add. */
export function describeCatalog(doc: Doc, catalog: Catalog, grant: Grant): string {
  const onPage = new Set(layers(doc).flatMap(function all(n): string[] {
    return [n.type, ...n.children.flatMap(all)];
  }));
  const types = Object.keys(catalog).filter((t) => onPage.has(t) || mayAdd(grant, t));
  return types
    .map((t) => {
      const fields = Object.entries(catalog[t].fields)
        .filter(([, f]) => may(grant, f.kind) && f.kind !== "style" && !["reference", "object"].includes(f.control))
        .map(([name, f]) => `${name} (${f.control === "choice" ? `one of ${f.options!.join("|")}` : f.control === "pt" ? "rich text" : f.control === "image" ? "image: an attached image" : f.control})`);
      const slot = blockMeta(t)?.slot;
      const holds = slot ? ` · holds ${slot.accepts?.join("|") ?? "any block"} in "${slot.field}"` : "";
      return `${t} — ${catalog[t].title}${holds}: ${fields.join(", ") || "(nothing you may edit)"}`;
    })
    .join("\n");
}

/** The single instruction sent to the model. */
export function buildInstruction(input: {
  doc: Doc;
  catalog: Catalog;
  grant: Grant;
  selection: string[];
  pages: PageRef[];
  history: ChatTurn[];
  request: string;
  images?: Attachment[];
}): string {
  const { doc, catalog, grant, selection, pages, history, request, images = [] } = input;
  const allowed = [...grant.can].filter((p) => p !== "chat" && p !== "publish").map((p) => `${p} (${PERMISSIONS[p]})`);
  const addable = Object.keys(catalog).filter((t) => mayAdd(grant, t));
  const style = may(grant, "style")
    ? `STYLE: op "style" sets one design token on a block. Props: ${Object.entries(STYLE_PROPS)
        .map(([p, v]) => `${p} (${v === "boolean" ? "true|false" : v.join("|")})`)
        .join(", ")}. Breakpoint: base (all screens, default) | tablet | mobile.`
    : "STYLE: not allowed for this person.";
  return [
    "You are the editing assistant inside the Remarkable Editor, a visual editor for a website built from blocks.",
    "You change the page ONLY by returning operations; the editor validates and applies them, and the person can undo them. Publishing is always done by a person, never by you.",
    "Reply in the same language the person writes in. Keep the reply short and concrete.",
    "",
    `PERMISSIONS of this person (role "${grant.label}"): ${allowed.join("; ") || "none"}.`,
    "Never return operations outside these permissions. If they ask for something not allowed, return no ops and say briefly that their role can't do it.",
    "",
    "PAGE (one block per line: path, type, current values):",
    describePage(doc, catalog, grant),
    "",
    `SELECTED in the editor ("this", "este", "acá" refer to these): ${selection.length ? selection.join(", ") : "nothing"}`,
    "",
    "FIELDS BY BLOCK TYPE:",
    describeCatalog(doc, catalog, grant),
    "",
    style,
    `BLOCKS YOU MAY ADD: ${addable.length ? addable.join(", ") : "none"}.`,
    pages.length ? `PAGES (for internal links): ${pages.map((p) => `${p.id} (/${p.slug ?? ""})`).join(", ")}` : "",
    "",
    history.length ? `CONVERSATION SO FAR:\n${history.map((t) => `${t.role}: ${t.text}`).join("\n")}\n` : "",
    images.length
      ? `ATTACHED IMAGES (you can see them): ${images.map((i) => `${i.id} ("${i.name}")`).join(", ")}. ${
          may(grant, "images")
            ? `To put one in an image field: {"op":"set","path":"<block path>","field":"<image field>","value":{"image":"<id>"}} (also inside "fields" of an insert).`
            : "This person can't change images: use them only as reference."
        }`
      : "",
    `REQUEST: ${request}`,
    "",
    'Respond in JSON with exactly this shape: {"reply": "<message to the person>", "ops": [<operations>]}',
    "Operations:",
    '{"op":"set","path":"<block path>","field":"<field>","value":<value>} — rich text and text take a plain string (\\n = new line); "one of" fields take one listed value; links take {"url":"https://…"} or {"page":"<page id>"}',
    '{"op":"style","path":"<block path>","prop":"<prop>","value":<token>,"breakpoint":"base"}',
    '{"op":"insert","type":"<block type>","after":"<block path or null>","into":"<container path or null>","fields":{"<field>":<value>}}',
    '{"op":"remove","path":"<block path>"}',
    '{"op":"duplicate","path":"<block path>"}',
    '{"op":"move","path":"<block path>","direction":"up|down"}',
    'Use only paths from PAGE. A block you insert has no path yet: give its values in "fields". Do not invent fields or values. "ops": [] when nothing should change.',
  ]
    .filter((l) => l !== "")
    .join("\n");
}

// ── Validation + application ──

export type ApplyResult = { doc: Doc; applied: string[]; rejected: string[]; touched: string[] };

const label = (doc: Doc, path: string) => {
  const t = resolveSelection(doc, path)?.item._type;
  return blockMeta(t)?.title ?? t ?? path;
};

/** Turn a model value into the stored value for this field, or throw why not. */
function coerce(f: CatalogField, value: unknown, current: unknown, images: AttachedImages): unknown {
  switch (f.control) {
    case "pt":
      if (typeof value !== "string") throw new Error("expects text");
      return plainToPt(value);
    case "text":
    case "textarea":
      if (typeof value !== "string") throw new Error("expects text");
      return value;
    case "lines":
      if (Array.isArray(value) && value.every((x) => typeof x === "string")) return value;
      if (typeof value === "string") return value.split("\n");
      throw new Error("expects a list of lines");
    case "choice":
      if (typeof value !== "string" || !f.options!.includes(value)) throw new Error(`must be one of ${f.options!.join(", ")}`);
      return value;
    case "number": {
      const n = typeof value === "number" ? value : Number(value);
      if (!Number.isFinite(n)) throw new Error("expects a number");
      return n;
    }
    case "boolean":
      if (typeof value !== "boolean") throw new Error("expects true or false");
      return value;
    case "link": {
      const v = value as { url?: unknown; page?: unknown };
      const base = (current && typeof current === "object" ? current : { _type: "link" }) as Record<string, unknown>;
      if (typeof v?.url === "string" && /^(https?:|mailto:|tel:|#)/.test(v.url)) return { ...base, kind: "external", url: v.url, page: undefined };
      if (typeof v?.page === "string") return { ...base, kind: "internal", page: { _type: "reference", _ref: v.page }, url: undefined };
      throw new Error('expects {"url": "https://…"} or {"page": "<page id>"}');
    }
    case "image": {
      const id = (value as { image?: unknown })?.image;
      if (typeof id !== "string" || !images[id]) throw new Error('expects {"image": "<attached image id>"}');
      return { ...(current && typeof current === "object" ? current : {}), ...(images[id] as object) };
    }
    default:
      throw new Error("can't be changed from the chat yet — use the panel");
  }
}

function setField(doc: Doc, path: string, field: string, value: unknown, catalog: Catalog, grant: Grant, images: AttachedImages = {}): Doc {
  if (path.includes(".__component.")) throw new Error("text inside a component: double-click it on the canvas");
  const item = resolveSelection(doc, path)?.item as Record<string, unknown> | undefined;
  if (!item) throw new Error("block not found");
  const f = catalog[item._type as string]?.fields[field];
  if (!f || f.kind === "style") throw new Error(`no field "${field}"`);
  if (!may(grant, f.kind)) throw new Error(`your role can't change ${f.kind}`);
  return setAt(doc, `${path}.${field}`, coerce(f, value, item[field], images));
}

/** Validate and apply ops in order. Each op either applies fully or is rejected with a reason. */
export function applyOps(doc: Doc, ops: unknown, ctx: { catalog: Catalog; grant: Grant; pages?: PageRef[]; images?: AttachedImages }): ApplyResult {
  const { catalog, grant, images = {} } = ctx;
  const applied: string[] = [];
  const rejected: string[] = [];
  const touched: string[] = [];
  let d = doc;
  for (const raw of Array.isArray(ops) ? (ops as Op[]) : []) {
    const name = raw && typeof raw === "object" ? `${raw.op}` : "op";
    try {
      switch (raw?.op) {
        case "set": {
          if (raw.field && ctx.pages && typeof (raw.value as { page?: unknown })?.page === "string" && !ctx.pages.some((p) => p.id === (raw.value as { page: string }).page))
            throw new Error("unknown page");
          d = setField(d, raw.path, raw.field, raw.value, catalog, grant, images);
          applied.push(`${label(d, raw.path)} · ${catalog[resolveSelection(d, raw.path)!.item._type]?.fields[raw.field]?.title ?? raw.field}`);
          touched.push(raw.path);
          break;
        }
        case "style": {
          if (!may(grant, "style")) throw new Error("your role can't change styles");
          if (!resolveSelection(d, raw.path)) throw new Error("block not found");
          const allowed = STYLE_PROPS[raw.prop];
          if (!allowed) throw new Error(`no style "${raw.prop}"`);
          const bp = raw.breakpoint ?? "base";
          if (!(BREAKPOINTS as readonly string[]).includes(bp)) throw new Error(`no breakpoint "${bp}"`);
          const ok = allowed === "boolean" ? typeof raw.value === "boolean" : allowed.includes(raw.value as string);
          if (!ok) throw new Error(`${raw.prop} must be ${allowed === "boolean" ? "true or false" : allowed.join(", ")}`);
          d = setAt(d, `${raw.path}.design.${bp}.${raw.prop}`, raw.value);
          applied.push(`${label(d, raw.path)} · ${raw.prop} = ${raw.value}${bp === "base" ? "" : ` (${bp})`}`);
          touched.push(raw.path);
          break;
        }
        case "insert": {
          if (!catalog[raw.type]) throw new Error(`no block type "${raw.type}"`);
          if (!mayAdd(grant, raw.type)) throw new Error(`your role can't add ${catalog[raw.type].title}`);
          let target: { arrayPath: string; index: number } | null = null;
          if (raw.into) {
            const r = resolveSelection(d, raw.into);
            const slot = r ? blockMeta(r.item._type)?.slot : undefined;
            const arrayPath = slot ? `${raw.into}.${slot.field}` : null;
            if (r && slot && arrayPath && canPlace(d, raw.type, arrayPath))
              target = { arrayPath, index: ((r.item[slot.field] as Block[] | undefined) ?? []).length };
          }
          if (!target && raw.after) {
            const r = resolveSelection(d, raw.after);
            if (r && canPlace(d, raw.type, r.parentArrayPath)) target = { arrayPath: r.parentArrayPath, index: r.index + 1 };
          }
          target ??= insertTarget(d, raw.after ?? raw.into ?? null, raw.type);
          if (!target) throw new Error(`a ${catalog[raw.type].title} can't go there`);
          const res = insert(d, target.arrayPath, target.index, newBlock(raw.type));
          d = res.doc;
          for (const [field, value] of Object.entries(raw.fields ?? {})) {
            try {
              d = setField(d, res.path, field, value, catalog, grant, images);
            } catch (e) {
              rejected.push(`new ${catalog[raw.type].title} · ${field}: ${(e as Error).message}`);
            }
          }
          applied.push(`+ ${catalog[raw.type].title}`);
          touched.push(res.path);
          break;
        }
        case "remove": {
          if (!may(grant, "structure")) throw new Error("your role can't delete blocks");
          if (!resolveSelection(d, raw.path)) throw new Error("block not found");
          applied.push(`− ${label(d, raw.path)}`);
          d = remove(d, raw.path);
          break;
        }
        case "duplicate": {
          const t = resolveSelection(d, raw.path)?.item._type;
          if (!t) throw new Error("block not found");
          if (!mayAdd(grant, t)) throw new Error(`your role can't add ${label(d, raw.path)}`);
          const res = duplicate(d, raw.path);
          d = res.doc;
          applied.push(`⧉ ${label(d, raw.path)}`);
          touched.push(res.path);
          break;
        }
        case "move": {
          if (!mayReorder(grant)) throw new Error("your role can't move blocks");
          if (!resolveSelection(d, raw.path)) throw new Error("block not found");
          const res = nudge(d, raw.path, raw.direction === "up" ? -1 : 1);
          d = res.doc;
          applied.push(`${label(d, raw.path)} ${raw.direction === "up" ? "↑" : "↓"}`);
          touched.push(res.path);
          break;
        }
        default:
          throw new Error("unknown operation");
      }
    } catch (e) {
      rejected.push(`${name}${(raw as { path?: string })?.path ? ` ${label(d, (raw as { path: string }).path)}` : ""}: ${(e as Error).message}`);
    }
  }
  return { doc: d, applied, rejected, touched };
}

/** Parse the model's answer (object or JSON string) into reply + ops. */
export function parseAnswer(raw: unknown): { reply: string; ops: unknown[] } {
  let v = raw;
  if (typeof v === "string") {
    const m = v.match(/\{[\s\S]*\}/);
    try {
      v = m ? JSON.parse(m[0]) : { reply: v };
    } catch {
      return { reply: v as string, ops: [] };
    }
  }
  const o = (v ?? {}) as { reply?: unknown; ops?: unknown };
  return { reply: typeof o.reply === "string" ? o.reply : "", ops: Array.isArray(o.ops) ? o.ops : [] };
}
