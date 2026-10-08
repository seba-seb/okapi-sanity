/**
 * Structural edits for the Remarkable Editor, as pure functions:
 * (document, path…) → new document. Immutable, so the editor can keep undo
 * snapshots and the canvas re-renders from plain props. Paths are the same
 * GROQ-style strings blocks stamp as `data-sanity-path`.
 */
import { parsePath, randomKey, reKey, resolveSelection } from "@/core/editor/paths";
import { acceptedTypes, blockMeta } from "@/blocks/meta";
import { INSERT_DEFAULTS } from "@/blocks/defaults";
import type { Block } from "@/core/lib/types";

export type Doc = { sections?: Block[] } & Record<string, unknown>;
type Node = Record<string, unknown> | unknown[] | undefined;

/** Copy-on-write update of whatever lives at `path` in `root`. */
function updateIn<T>(root: T, path: string, fn: (node: Node) => Node): T {
  const steps = parsePath(path);
  const rec = (node: Node, i: number): Node => {
    if (i === steps.length) return fn(node);
    const step = steps[i];
    if ("field" in step) {
      const obj = { ...((node as Record<string, unknown>) ?? {}) };
      obj[step.field] = rec(obj[step.field] as Node, i + 1);
      return obj;
    }
    const arr = [...((node as unknown[]) ?? [])];
    const idx = "key" in step ? arr.findIndex((x) => (x as Block)?._key === step.key) : step.index;
    if (idx < 0 || idx >= arr.length) throw new Error(`Path not found: ${path}`);
    arr[idx] = rec(arr[idx] as Node, i + 1);
    return arr;
  };
  return rec(root as Node, 0) as T;
}

const itemPath = (arrayPath: string, key: string) => `${arrayPath}[_key=="${key}"]`;

/** The array path's owner: "page" for `sections`, else the block that holds it. */
function ownerType(doc: Doc, arrayPath: string): string | null {
  if (arrayPath === "sections") return "page";
  const ownerPath = arrayPath.slice(0, arrayPath.lastIndexOf("."));
  return resolveSelection(doc, ownerPath)?.item._type ?? null;
}

/** May a block of `type` live in the array at `arrayPath`? (registry rules) */
export function canPlace(doc: Doc, type: string, arrayPath: string): boolean {
  const owner = ownerType(doc, arrayPath);
  if (owner === "page") return type === "section";
  if (!owner) return false;
  const slot = blockMeta(owner)?.slot;
  const field = arrayPath.slice(arrayPath.lastIndexOf(".") + 1);
  return !!slot && slot.field === field && (acceptedTypes(owner) ?? []).includes(type);
}

/** A fresh block with the same defaults the canvas inserts use. */
export function newBlock(type: string): Block {
  const defaults =
    type === "section"
      ? { theme: "light", paddingTop: "medium", paddingBottom: "medium", gap: "md", contentAlign: "start", content: [newBlock("heading")] }
      : (INSERT_DEFAULTS[type]?.() ?? {});
  return reKey({ _type: type, _key: randomKey(), ...defaults }) as Block;
}

export function insert(doc: Doc, arrayPath: string, index: number, block: Block): { doc: Doc; path: string } {
  if (!canPlace(doc, block._type, arrayPath)) throw new Error(`${block._type} can't go in ${arrayPath}`);
  const next = updateIn(doc, arrayPath, (arr) => {
    const a = [...((arr as Block[]) ?? [])];
    a.splice(Math.max(0, Math.min(index, a.length)), 0, block);
    return a;
  });
  return { doc: next, path: itemPath(arrayPath, block._key) };
}

export function remove(doc: Doc, path: string): Doc {
  const r = resolveSelection(doc, path);
  if (!r) return doc;
  return updateIn(doc, r.parentArrayPath, (arr) => (arr as Block[]).filter((x) => x._key !== r.item._key));
}

export function duplicate(doc: Doc, path: string): { doc: Doc; path: string } {
  const r = resolveSelection(doc, path);
  if (!r) return { doc, path };
  return insert(doc, r.parentArrayPath, r.index + 1, reKey(r.item));
}

/** Move to `toArrayPath` at `toIndex` (index in the array AFTER removal). */
export function move(doc: Doc, path: string, toArrayPath: string, toIndex: number): { doc: Doc; path: string } {
  const r = resolveSelection(doc, path);
  if (!r) return { doc, path };
  if (toArrayPath.startsWith(path)) throw new Error("Can't move a block inside itself");
  if (!canPlace(doc, r.item._type, toArrayPath)) throw new Error(`${r.item._type} can't go in ${toArrayPath}`);
  return insert(remove(doc, path), toArrayPath, toIndex, r.item);
}

/** One step up/down among its siblings. */
export function nudge(doc: Doc, path: string, dir: -1 | 1): { doc: Doc; path: string } {
  const r = resolveSelection(doc, path);
  if (!r) return { doc, path };
  const to = r.index + dir;
  if (to < 0 || to >= r.parentArray.length) return { doc, path };
  return move(doc, path, r.parentArrayPath, to);
}

/**
 * Where a new `type` goes given the current selection: inside the selected
 * container if it accepts it, else right after the selection (climbing up
 * until some parent accepts it). Nothing selected: sections go last; other
 * blocks go at the end of the last section.
 */
export function insertTarget(doc: Doc, selected: string | null, type: string): { arrayPath: string; index: number } | null {
  let cur = selected;
  while (cur) {
    const r = resolveSelection(doc, cur);
    if (!r) break;
    const slot = blockMeta(r.item._type)?.slot;
    if (slot) {
      const inside = `${cur}.${slot.field}`;
      if (canPlace(doc, type, inside)) return { arrayPath: inside, index: ((r.item[slot.field] as Block[]) ?? []).length };
    }
    if (canPlace(doc, type, r.parentArrayPath)) return { arrayPath: r.parentArrayPath, index: r.index + 1 };
    cur = r.parentArrayPath.includes("[") ? r.parentArrayPath.slice(0, r.parentArrayPath.lastIndexOf(".")) : null;
  }
  const sections = doc.sections ?? [];
  if (type === "section") return { arrayPath: "sections", index: sections.length };
  const last = sections.at(-1);
  if (!last) return null;
  const arrayPath = `${itemPath("sections", last._key)}.content`;
  return canPlace(doc, type, arrayPath) ? { arrayPath, index: ((last.content as Block[]) ?? []).length } : null;
}

/** The enclosing block's path, or null at the top. */
export function parentBlock(path: string): string | null {
  const r = path.lastIndexOf("[_key==");
  const before = path.slice(0, r);
  const j = before.lastIndexOf("[_key==");
  return j < 0 ? null : before.slice(0, before.indexOf("]", j) + 1);
}

/** Tree for the layers panel: every block with its slot children. */
export type LayerNode = { path: string; type: string; title: string; children: LayerNode[]; childArray?: string };
export function layers(doc: Doc): LayerNode[] {
  const walk = (items: Block[] | undefined, arrayPath: string): LayerNode[] =>
    (items ?? []).map((item) => {
      const path = itemPath(arrayPath, item._key);
      const slot = blockMeta(item._type)?.slot;
      const name = typeof item.name === "string" && item.name ? ` — ${item.name}` : "";
      return {
        path,
        type: item._type,
        title: `${blockMeta(item._type)?.title ?? item._type}${name}`,
        childArray: slot ? `${path}.${slot.field}` : undefined,
        children: slot ? walk(item[slot.field] as Block[] | undefined, `${path}.${slot.field}`) : [],
      };
    });
  return walk(doc.sections, "sections");
}
