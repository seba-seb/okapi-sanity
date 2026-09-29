/**
 * Pure helpers for the block mutation endpoint: parsing the GROQ-style path the
 * front-end stamps as `data-sanity-path`, walking the document to the selected
 * array item, and deep re-keying a subtree so a duplicate/paste never collides
 * with the keys already in the document.
 */

import type { Block } from "./types";

type Step = { field: string } | { key: string } | { index: number };

/**
 * Tokenizes a path like `sections[_key=="a"].content[_key=="b"]` into ordered
 * steps. Dots are plain separators and fall through the regex untouched.
 */
export function parsePath(path: string): Step[] {
  const steps: Step[] = [];
  const re = /([A-Za-z0-9_]+)|\[_key=="([^"]+)"\]|\[(-?\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(path)) !== null) {
    if (m[1] !== undefined) steps.push({ field: m[1] });
    else if (m[2] !== undefined) steps.push({ key: m[2] });
    else if (m[3] !== undefined) steps.push({ index: Number(m[3]) });
  }
  return steps;
}

export type Resolved = {
  /** The selected array item. */
  item: Block;
  /** The array the item lives in. */
  parentArray: Block[];
  /** GROQ path to that array, e.g. `sections[_key=="a"].content`. */
  parentArrayPath: string;
  /** GROQ path to the item itself (equal to the input path). */
  itemPath: string;
  /** The item's index within `parentArray`. */
  index: number;
};

/**
 * Walks `root` following `path` and returns the selected array item together
 * with the array that holds it. Returns null if the path can't be resolved
 * (e.g. the block was deleted or the path is malformed).
 */
export function resolveSelection(root: unknown, path: string): Resolved | null {
  const steps = parsePath(path);
  if (!steps.length) return null;

  let node: unknown = root;
  let parentArray: Block[] | null = null;
  let parentArrayPath = "";
  let index = -1;
  let curPath = "";

  for (const step of steps) {
    if ("field" in step) {
      node = node == null ? undefined : (node as Record<string, unknown>)[step.field];
      curPath = curPath ? `${curPath}.${step.field}` : step.field;
      continue;
    }

    if (!Array.isArray(node)) return null;
    const arr = node as Block[];
    parentArray = arr;
    parentArrayPath = curPath;

    if ("key" in step) {
      index = arr.findIndex((x) => x && x._key === step.key);
      curPath = `${curPath}[_key=="${step.key}"]`;
    } else {
      index = step.index < 0 ? arr.length + step.index : step.index;
      curPath = `${curPath}[${step.index}]`;
    }
    if (index < 0 || index >= arr.length) return null;
    node = arr[index];
  }

  if (node == null || typeof node !== "object" || parentArray == null) return null;
  return { item: node as Block, parentArray, parentArrayPath, itemPath: path, index };
}

export function randomKey(length = 12): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.getRandomValues) {
    const bytes = new Uint8Array(length);
    c.getRandomValues(bytes);
    let out = "";
    for (const b of bytes) out += (b % 36).toString(36);
    return out;
  }
  let out = "";
  while (out.length < length) out += Math.random().toString(36).slice(2);
  return out.slice(0, length);
}

/**
 * Deep-clones `value`, assigning a fresh `_key` to every object that has one
 * (the item itself and every nested array member), so the clone is safe to
 * insert alongside the original.
 */
export function reKey<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => reKey(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = k === "_key" ? randomKey() : reKey(v);
    }
    return out as T;
  }
  return value;
}

/** The `_key` of the top-level section a path lives under, if any. */
export function topSectionKey(path: string): string | null {
  const m = path.match(/^sections\[_key=="([^"]+)"\]/);
  return m ? m[1] : null;
}

/** The innermost array-item `_key` in a path, or null (e.g. bare `sections`). */
export function lastKeyOf(path: string): string | null {
  const all = [...path.matchAll(/\[_key=="([^"]+)"\]/g)];
  return all.length ? all[all.length - 1][1] : null;
}

export type Slot = { field: string; accepts?: string | string[] };

/**
 * The array field a block nests children into ("slot"), or null for a leaf
 * block. `accepts` restricts which block types belong in the slot — a Button
 * Group only holds buttons, a Content wrapper only holds copy blocks — so an
 * unaccepted type falls back to a sibling insert instead of nesting somewhere
 * the schema forbids. Omit `accepts` to take any block type.
 */
const SLOTS: Record<string, Slot> = {
  section: { field: "content" },
  // Grid cells / slider slides hold layout blocks, not loose text/buttons.
  // Mirrors gridCellMembers()/cardOrImageMembers() in shared/blocks.ts.
  grid: {
    field: "items",
    accepts: ["card", "contentWrapper", "imageBlock", "logo3d"],
  },
  slider: { field: "slides", accepts: ["card", "imageBlock"] },
  buttonWrapper: { field: "buttons", accepts: "button" },
  // Mirrors contentWrapper's schema `of` list (see blocks/contentWrapper.ts).
  contentWrapper: {
    field: "content",
    accepts: ["eyebrow", "heading", "paragraph", "buttonWrapper"],
  },
};

export function slotFor(type: string | undefined): Slot | null {
  return type ? (SLOTS[type] ?? null) : null;
}

/** Whether a slot admits a given block type (no `accepts` → admits anything). */
export function slotAccepts(slot: Slot, type: string): boolean {
  if (!slot.accepts) return true;
  return Array.isArray(slot.accepts)
    ? slot.accepts.includes(type)
    : slot.accepts === type;
}
