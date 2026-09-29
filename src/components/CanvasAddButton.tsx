"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDocuments } from "@sanity/visual-editing/react";

import {
  slotFor,
  slotAccepts,
  resolveSelection,
  lastKeyOf,
} from "@/lib/editorOps";
import {
  buildBlock,
  appendIntoSlot,
  applySlotDefaults,
} from "@/lib/canvasInsert";
import { selectElementByKey } from "@/lib/canvasSelect";
import { blockTitle } from "@/sanity/dataAttr";
import type { Block } from "@/lib/types";

/**
 * A contextual "+" on the Presentation canvas.
 *
 * Select a container (a block with a "slot" — grid, section, slider, content
 * wrapper, button group) and a "+" appears on its bottom edge. Clicking
 * it lists exactly the block types that slot accepts — a grid, for instance,
 * only offers Card / Content / Image — and inserts the chosen one into the
 * container, keeping it selected so you can add several.
 *
 * Mounted only inside the preview (draft mode). Writes ride the same optimistic
 * document store as the rest of the canvas editing (`useDocuments().patch`).
 */

type Target = { el: HTMLElement; id: string; path: string; type: string };

/** Fallback menu for slots with no `accepts` restriction (section/container). */
const GENERAL_TYPES = [
  "heading",
  "paragraph",
  "eyebrow",
  "buttonWrapper",
  "button",
  "imageBlock",
  "loopingVideo",
  "contentWrapper",
  "card",
  "grid",
  "slider",
];

function allowedFor(type: string): string[] | null {
  const slot = slotFor(type);
  if (!slot) return null;
  if (!slot.accepts) return GENERAL_TYPES;
  return Array.isArray(slot.accepts) ? slot.accepts : [slot.accepts];
}

// Below CanvasResizer's handle (2147483000), above the visual-editing overlay.
const Z = 2147482000;

export function CanvasAddButton() {
  const { getDocument } = useDocuments();
  const getDocumentRef = useRef(getDocument);
  getDocumentRef.current = getDocument;

  const targetRef = useRef<Target | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const busyRef = useRef(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [menu, setMenu] = useState<string[] | null>(null);

  const reposition = useCallback(() => {
    const t = targetRef.current;
    if (!t || !document.contains(t.el)) {
      targetRef.current = null;
      setPos(null);
      setMenu(null);
      return;
    }
    const r = t.el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) {
      setPos(null);
      return;
    }
    setPos({ x: r.left + r.width / 2, y: r.bottom });
  }, []);

  // Show the "+" whenever the clicked element is a container (has a slot).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (rootRef.current && t && rootRef.current.contains(t)) return; // our UI
      const el = t?.closest<HTMLElement>(
        "[data-sanity-type][data-sanity-path][data-sanity-id]",
      );
      const type = el?.getAttribute("data-sanity-type") ?? "";
      if (el && slotFor(type)) {
        targetRef.current = {
          el,
          id: el.getAttribute("data-sanity-id") || "",
          path: el.getAttribute("data-sanity-path") || "",
          type,
        };
        setMenu(null);
        reposition();
      } else {
        targetRef.current = null;
        setMenu(null);
        setPos(null);
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenu(null);
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [reposition]);

  const insert = useCallback(async (type: string) => {
    const t = targetRef.current;
    if (!t || busyRef.current) return;
    busyRef.current = true;
    try {
      const doc = getDocumentRef.current(t.id);
      const snapshot = (await doc.getSnapshot()) as Record<
        string,
        unknown
      > | null;
      if (!snapshot) return;
      const resolved = resolveSelection(snapshot, t.path);
      const slot = slotFor(t.type);
      if (!resolved || !slot || !slotAccepts(slot, type)) return;

      const siblings =
        ((resolved.item as Record<string, unknown>)[slot.field] as
          | Block[]
          | undefined) ?? [];
      const block = buildBlock(type);
      applySlotDefaults(block, slot, siblings);
      const patch = appendIntoSlot(
        `${resolved.itemPath}.${slot.field}`,
        siblings,
        block,
      );

      doc.patch([patch] as never);
      setMenu(null);
      // Re-select the container so the "+" stays put for adding more.
      const containerKey = lastKeyOf(t.path);
      if (containerKey) selectElementByKey(containerKey);
    } catch {
      // No optimistic actor / transient store error — ignore.
    } finally {
      busyRef.current = false;
    }
  }, []);

  if (!pos) return null;
  const type = targetRef.current?.type ?? "";

  return (
    <div
      ref={rootRef}
      style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: Z }}
    >
      <button
        type="button"
        title="Add element"
        aria-label="Add element"
        onClick={(e) => {
          e.stopPropagation();
          setMenu((m) => (m ? null : (allowedFor(type) ?? [])));
        }}
        style={{
          position: "fixed",
          left: pos.x,
          top: pos.y,
          transform: "translate(-50%, -50%)",
          width: 26,
          height: 26,
          borderRadius: "50%",
          border: "2px solid #fff",
          background: "#3b82f6",
          color: "#fff",
          fontSize: 18,
          lineHeight: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          boxShadow: "0 1px 6px rgba(0,0,0,0.35)",
          pointerEvents: "auto",
        }}
      >
        +
      </button>

      {menu ? (
        <div
          style={{
            position: "fixed",
            left: pos.x,
            top: pos.y + 18,
            transform: "translateX(-50%)",
            minWidth: 160,
            background: "#fff",
            border: "1px solid #e4e4e9",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            padding: 4,
            pointerEvents: "auto",
            maxHeight: 320,
            overflowY: "auto",
          }}
        >
          {menu.map((child) => (
            <button
              key={child}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                void insert(child);
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f1f1f5";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "7px 10px",
                border: "none",
                background: "transparent",
                borderRadius: 6,
                fontSize: 13,
                color: "#0b0b0f",
                cursor: "pointer",
              }}
            >
              {blockTitle(child)}
            </button>
          ))}
          {menu.length === 0 ? (
            <div style={{ padding: "7px 10px", fontSize: 13, color: "#8a8a94" }}>
              Nothing to add
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
