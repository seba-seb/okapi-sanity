"use client";

import { useEffect, useRef } from "react";
import { useDocuments } from "@sanity/visual-editing/react";
import { at, insert, set, truncate } from "@sanity/mutate";

import {
  EDITOR_CHANNEL,
  actionForKey,
  hasTextSelection,
  isEditableTarget,
  type EditorAction,
  type EditorMessage,
} from "@/lib/editorBridge";
import {
  resolveSelection,
  reKey,
  topSectionKey,
  lastKeyOf,
} from "@/lib/editorOps";
import { selectElementByKey } from "@/lib/canvasSelect";
import { clean } from "@/lib/clean";
import type { Block } from "@/lib/types";

/**
 * The block keyboard shortcuts inside the Presentation preview:
 *
 *   Delete / Backspace  → remove the selected element
 *   ⌘/Ctrl + D          → duplicate it (inserted right after)
 *   ⌘/Ctrl + C          → copy it
 *   ⌘/Ctrl + V          → paste under the selected element (or INTO it when a
 *                         section is selected and the clipboard isn't a section)
 *
 * Like the sibling `KeyboardReorder`, it writes through the SAME optimistic
 * document store the library's drag-to-reorder uses (`useDocuments().patch`), so
 * the change shows in the preview instantly instead of waiting for a save
 * round-trip. Mounted only inside the preview (draft mode), beside
 * `<VisualEditing>`. Renders nothing.
 */

type Selection = { id: string; path: string };

export function EditorShortcuts() {
  const { getDocument } = useDocuments();
  // Keep a live ref so the listeners (registered once) always call the current
  // getDocument without re-subscribing on every render.
  const getDocumentRef = useRef(getDocument);
  getDocumentRef.current = getDocument;

  const selectionRef = useRef<Selection | null>(null);
  const clipboardRef = useRef<Block | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    async function run(action: EditorAction) {
      const selection = selectionRef.current;
      if (!selection || busyRef.current) return;
      busyRef.current = true;
      try {
        const doc = getDocumentRef.current(selection.id);
        const snapshot = await doc.getSnapshot();
        if (!snapshot) return;
        const resolved = resolveSelection(snapshot, selection.path);
        if (!resolved) return;
        const { item, itemPath, parentArrayPath, index, parentArray } =
          resolved;

        if (action === "copy") {
          clipboardRef.current = clean(
            JSON.parse(JSON.stringify(item)),
          ) as Block;
          return;
        }

        if (action === "delete") {
          // Pick what to select once this element is gone: the previous
          // sibling, else the next sibling (the new first), else the parent
          // container it lived in.
          const nextKey =
            index > 0
              ? (parentArray[index - 1]?._key ?? null)
              : parentArray.length > 1
                ? (parentArray[index + 1]?._key ?? null)
                : lastKeyOf(parentArrayPath);

          // Same remove shape the library's own delete action uses.
          doc.patch([at(parentArrayPath, truncate(index, index + 1))]);
          selectionRef.current = null;
          if (nextKey) selectElementByKey(nextKey);
          return;
        }

        if (action === "duplicate") {
          const clone = reKey(item);
          // A button duplicated inside a Button Group takes the "secondary"
          // style — a group's follow-on button reads as the secondary action.
          if (item._type === "button" && parentArrayPath.endsWith(".buttons")) {
            (clone as Record<string, unknown>).style = "secondary";
          }
          doc.patch([
            at(parentArrayPath, insert([clone], "after", { _key: item._key })),
          ]);
          return;
        }

        // paste
        if (clipboardRef.current == null) return;
        const fresh = reKey(clipboardRef.current);

        // Rule 1: a non-section pasted onto a section drops INTO the section.
        if (item._type === "section" && fresh._type !== "section") {
          const children = (item as { content?: Block[] }).content ?? [];
          const arrPath = `${itemPath}.content`;
          const patch = children.length
            ? at(arrPath, insert([fresh], "after", {
                _key: children[children.length - 1]._key,
              }))
            : at(arrPath, set([fresh]));
          doc.patch([patch]);
          return;
        }

        // Rule 2: a section can only live at the top level, so paste it after
        // the selected element's own section.
        if (fresh._type === "section") {
          const secKey =
            item._type === "section"
              ? item._key
              : topSectionKey(selection.path);
          let patch;
          if (secKey) {
            patch = at("sections", insert([fresh], "after", { _key: secKey }));
          } else {
            const secs = (snapshot as { sections?: Block[] }).sections ?? [];
            patch = secs.length
              ? at("sections", insert([fresh], "after", {
                  _key: secs[secs.length - 1]._key,
                }))
              : at("sections", set([fresh]));
          }
          doc.patch([patch]);
          return;
        }

        // Rule 3: paste a block right under the selected block (as a sibling).
        doc.patch([
          at(parentArrayPath, insert([fresh], "after", { _key: item._key })),
        ]);
      } catch (err) {
        // No optimistic actor (not in Presentation) or a transient store error.
        if (process.env.NODE_ENV === "development") {
          console.warn("EditorShortcuts: command failed", err);
        }
      } finally {
        busyRef.current = false;
      }
    }

    // Track the last editable element the user clicked as the "selection". The
    // overlay is pointer-events:none, so clicks reach the content and this fires
    // on the same element the overlay draws its focus ring on.
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>(
        "[data-sanity-id][data-sanity-path]",
      );
      if (el && el.dataset.sanityId && el.dataset.sanityPath) {
        selectionRef.current = {
          id: el.dataset.sanityId,
          path: el.dataset.sanityPath,
        };
        // Tell the Studio a canvas click happened so it can bounce the field
        // autofocus back to the canvas (see CanvasAutofocusGuard).
        channel?.postMessage({ type: "canvas-select" });
      } else {
        selectionRef.current = null;
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const action = actionForKey(e);
      if (!action) return;
      if (isEditableTarget(e.target)) return;
      if (action === "copy" && hasTextSelection(document)) return;
      if (!selectionRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      void run(action);
    };

    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel(EDITOR_CHANNEL)
        : null;
    if (channel) {
      channel.onmessage = (e: MessageEvent<EditorMessage>) => {
        if (e.data?.type === "command") void run(e.data.action);
      };
    }

    document.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKeyDown, true);
      channel?.close();
    };
  }, []);

  return null;
}
