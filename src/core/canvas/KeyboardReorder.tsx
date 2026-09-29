"use client";

import { useEffect, useRef } from "react";
import { useDocuments } from "@sanity/visual-editing/react";
import { at, insert, truncate } from "@sanity/mutate";

/**
 * Keyboard reordering on the Presentation canvas.
 *
 * With an element selected (clicked) on the page, ArrowUp moves it up one sibling
 * and ArrowDown moves it down one sibling within its owning array. Plain arrows
 * are used because the obvious modifiers are all taken: Presentation reserves
 * Option/Alt to toggle edit mode, and Shift+Arrow is the browser's "extend text
 * selection" gesture. Arrows are hijacked ONLY while an element is selected — with
 * nothing selected (or after Esc) they scroll the page as usual.
 *
 * Mounted only inside the preview (draft mode), beside <VisualEditing>. It
 * reuses the SAME optimistic document store the library's drag-to-reorder uses
 * (`useDocuments().patch`), so a keyboard move and a drag move take the exact
 * same write path and both stream back through the Studio — no Studio-side
 * handler needed. Importing `useDocuments` from the same static entry as
 * <VisualEditing> keeps them on one module instance so they share the
 * optimistic actor (see the chunk-duplication note in VisualEditingBridge).
 */

type Selection = { id: string; path: string };
type MoveDir = "previous" | "next";

/**
 * Splits a block's GROQ path into its parent array path and item key, e.g.
 * `sections[_key=="s"].content[_key=="c"]` ->
 * `{ arrayPath: 'sections[_key=="s"].content', key: "c" }`. Mirrors the
 * library's own `getArrayItemKeyAndParentPath`. Returns null when the path's
 * last segment isn't an array item (nothing to reorder).
 */
function parseArrayItem(path: string): { arrayPath: string; key: string } | null {
  const lastBracket = path.lastIndexOf("[");
  if (lastBracket < 0) return null;
  const lastSeg = path.slice(path.lastIndexOf(".") + 1);
  if (!lastSeg.includes("[")) return null;
  const arrayPath = path.slice(0, lastBracket);
  let key: string;
  if (lastSeg.includes("_key")) {
    const start = lastSeg.indexOf('"') + 1;
    key = lastSeg.slice(start, lastSeg.indexOf('"', start));
  } else {
    const start = lastSeg.indexOf("[") + 1;
    key = lastSeg.slice(start, lastSeg.indexOf("]", start));
  }
  return arrayPath && key ? { arrayPath, key } : null;
}

/** Resolves a GROQ-ish path (fields, `[_key=="x"]`, `[n]`) against a snapshot. */
function readValue(root: unknown, path: string): unknown {
  const re = /([^.[\]]+)|\[_key\s*==\s*["']([^"']+)["']\]|\[(\d+)\]/g;
  let acc: unknown = root;
  let m: RegExpExecArray | null;
  while ((m = re.exec(path)) !== null) {
    const [, field, itemKey, index] = m;
    if (field !== undefined) {
      acc =
        acc && typeof acc === "object"
          ? (acc as Record<string, unknown>)[field]
          : undefined;
    } else if (itemKey !== undefined) {
      acc = Array.isArray(acc)
        ? acc.find((x) => (x as { _key?: string })?._key === itemKey)
        : undefined;
    } else {
      acc = Array.isArray(acc) ? acc[Number(index)] : undefined;
    }
  }
  return acc;
}

function isEditableTarget(node: EventTarget | null): boolean {
  const el = node as HTMLElement | null;
  if (!el) return false;
  return (
    el.isContentEditable ||
    el.tagName === "INPUT" ||
    el.tagName === "TEXTAREA" ||
    el.tagName === "SELECT"
  );
}

export function KeyboardReorder() {
  const { getDocument } = useDocuments();
  // Keep a live ref so the listeners (registered once) always call the current
  // getDocument without re-subscribing on every render.
  const getDocumentRef = useRef(getDocument);
  getDocumentRef.current = getDocument;

  const selectionRef = useRef<Selection | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    // Track the last editable element the user clicked as the "selection". The
    // Presentation overlay draws its focus ring on that same click, so this
    // stays in sync with what the user sees selected. (Overlay elements are
    // pointer-events:none, so clicks reach the content and this fires.)
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>(
        "[data-sanity-id][data-sanity-path]",
      );
      selectionRef.current =
        el && el.dataset.sanityId && el.dataset.sanityPath
          ? { id: el.dataset.sanityId, path: el.dataset.sanityPath }
          : null;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      // Any modifier means another gesture (Shift = select text, Alt = toggle
      // edit mode, ⌘/Ctrl = browser shortcuts) — leave those to the browser.
      if (e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;

      // Esc releases the canvas selection so plain arrows scroll again.
      if (e.key === "Escape") {
        selectionRef.current = null;
        return;
      }

      const dir: MoveDir | null =
        e.key === "ArrowUp" ? "previous" : e.key === "ArrowDown" ? "next" : null;
      if (!dir) return;
      if (isEditableTarget(document.activeElement)) return;
      const selection = selectionRef.current;
      if (!selection) return; // nothing selected → let arrows scroll the page

      e.preventDefault();
      e.stopPropagation();
      if (busyRef.current) return; // ignore key auto-repeat while a move is applying
      busyRef.current = true;
      void move(getDocumentRef.current, selection, dir).finally(() => {
        busyRef.current = false;
      });
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);

  return null;
}

async function move(
  getDocument: ReturnType<typeof useDocuments>["getDocument"],
  selection: Selection,
  dir: MoveDir,
): Promise<void> {
  const parsed = parseArrayItem(selection.path);
  if (!parsed) return;
  try {
    const doc = getDocument(selection.id);
    const snapshot = await doc.getSnapshot();
    const array = readValue(snapshot, parsed.arrayPath);
    if (!Array.isArray(array)) return;
    const index = array.findIndex(
      (x) => (x as { _key?: string })?._key === parsed.key,
    );
    if (index < 0) return;
    const item = array[index];

    // Same remove-then-insert shape the library's move actions use.
    const patches =
      dir === "previous"
        ? index === 0
          ? []
          : [
              at(parsed.arrayPath, truncate(index, index + 1)),
              at(parsed.arrayPath, insert(item, "before", index - 1)),
            ]
        : index === array.length - 1
          ? []
          : [
              at(parsed.arrayPath, truncate(index, index + 1)),
              at(parsed.arrayPath, insert(item, "after", index)),
            ];

    if (patches.length) await doc.patch(patches);
  } catch (err) {
    // No optimistic actor (not in Presentation) or a transient store error —
    // safe to ignore; the canvas simply won't reorder.
    if (process.env.NODE_ENV === "development") {
      console.warn("KeyboardReorder: move failed", err);
    }
  }
}
