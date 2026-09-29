"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDocuments } from "@sanity/visual-editing/react";
import { at, set } from "@sanity/mutate";

import { MARGIN_SCALE, snapSpacing } from "@/lib/spacingScale";

/**
 * On-canvas BOTTOM-margin handle for text blocks (Eyebrow / Heading /
 * Paragraph) — the sibling of `SpacingResizer`'s TOP-margin handle for the
 * Button Group. Hovering a text block shows a grabber at its bottom edge with a
 * shaded band for the current bottom margin; drag down for more space, up for
 * less, snapping the full spacing scale (None … 3XL). It previews live and
 * commits the chosen token to the block's `marginBottom` field on release via
 * the optimistic document store. Mounted only inside the Presentation preview.
 *
 * The block's editable element (the `<h*>`/`<p>`) carries `data-sanity-*`, but
 * the margin lives on its `.align-block` wrapper (see AlignBlock) — so we
 * read/write the wrapper while committing to the inner element's path.
 */

const Z = 2147483000;
const GRAB_W = 56;
const GRAB_H = 8;

const TYPES = new Set(["eyebrow", "heading", "paragraph"]);

// `marginEl` (the `.align-block` wrapper) owns the margin value + bottom edge;
// `inner` (the actual `<h*>`/`<p>`/eyebrow) gives the real rendered width the
// band should span/centre on — the wrapper is always full-width.
type Target = {
  marginEl: HTMLElement;
  inner: HTMLElement;
  path: string;
  id: string;
};
type View = { left: number; width: number; bottom: number; marginPx: number };
type Drag = { startY: number; startMargin: number };

export function BlockMarginResizer() {
  const { getDocument } = useDocuments();
  const getDocumentRef = useRef(getDocument);
  getDocumentRef.current = getDocument;

  const [view, setView] = useState<View | null>(null);
  const [label, setLabel] = useState<{ text: string; x: number; y: number } | null>(
    null,
  );

  const targetRef = useRef<Target | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const liveTokenRef = useRef<string | null>(null);
  const grabRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef(0);

  const reposition = useCallback(() => {
    if (dragRef.current) return; // pointer drives the visuals mid-drag
    const t = targetRef.current;
    if (!t) {
      setView(null);
      return;
    }
    // Span/centre the band on the inner element's real width; the wrapper's
    // bottom (where the margin starts) coincides with the inner element's since
    // the wrapper hugs its single child.
    const r = t.inner.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) {
      setView(null);
      return;
    }
    // margin-bottom sits OUTSIDE the border box, so the block's own bottom edge
    // (grabber anchor) is stable as the margin changes — only the band grows.
    const marginPx = parseFloat(getComputedStyle(t.marginEl).marginBottom) || 0;
    setView({ left: r.left, width: r.width, bottom: r.bottom, marginPx });
  }, []);

  const clearTarget = useCallback(() => {
    if (dragRef.current) return;
    targetRef.current = null;
    setView(null);
  }, []);

  // Track which text block is under the pointer.
  useEffect(() => {
    const detect = (x: number, y: number) => {
      const stack = document.elementsFromPoint(x, y) as HTMLElement[];
      if (grabRef.current && stack.includes(grabRef.current)) return; // keep
      const inner = stack.find((el) =>
        TYPES.has(el.getAttribute?.("data-sanity-type") ?? ""),
      );
      const marginEl = inner?.closest<HTMLElement>(".align-block") ?? null;
      if (inner && marginEl) {
        targetRef.current = {
          marginEl,
          inner,
          path: inner.getAttribute("data-sanity-path") || "",
          id: inner.getAttribute("data-sanity-id") || "",
        };
        reposition();
      } else {
        clearTarget();
      }
    };

    const onMove = (e: PointerEvent) => {
      if (dragRef.current) return;
      const x = e.clientX;
      const y = e.clientY;
      if (rafRef.current) return; // coalesce to one hit-test per frame
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        detect(x, y);
      });
    };

    document.addEventListener("pointermove", onMove);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("pointermove", onMove);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [reposition, clearTarget]);

  const commit = useCallback((token: string) => {
    const target = targetRef.current;
    if (!target?.path || !target.id) return;
    try {
      getDocumentRef.current(target.id).patch([
        at(`${target.path}.marginBottom`, set(token)),
      ]);
    } catch {
      // no optimistic actor (not in Presentation) — ignore
    }
  }, []);

  const onDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const target = targetRef.current;
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startY: e.clientY,
      startMargin: parseFloat(getComputedStyle(target.marginEl).marginBottom) || 0,
    };
    liveTokenRef.current = null;
  }, []);

  const onDragMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    const target = targetRef.current;
    if (!d || !target) return;
    // Drag down = more space below; up = less (toward 0).
    const snapped = snapSpacing(
      MARGIN_SCALE,
      Math.max(0, d.startMargin + (e.clientY - d.startY)),
    );
    target.marginEl.style.marginBottom = `${snapped.px}px`;
    liveTokenRef.current = snapped.token;
    setLabel({
      text: `Bottom · ${snapped.token.toUpperCase()}`,
      x: e.clientX + 14,
      y: e.clientY - 10,
    });
    setView((prev) => (prev ? { ...prev, marginPx: snapped.px } : prev));
  }, []);

  const onDragUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      if (!d) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // capture already gone — ignore
      }
      const token = liveTokenRef.current;
      if (token) commit(token);
      dragRef.current = null;
      liveTokenRef.current = null;
      setLabel(null);
      reposition();
    },
    [commit, reposition],
  );

  if (!view) return null;

  const grabLeft = view.left + view.width / 2 - GRAB_W / 2;

  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: Z }}>
      {/* Bottom-margin shaded region (visual only). */}
      {view.marginPx > 0 ? (
        <div
          style={{
            position: "fixed",
            left: view.left,
            top: view.bottom,
            width: view.width,
            height: view.marginPx,
            background:
              "repeating-linear-gradient(-45deg, rgba(59,130,246,0.12) 0 6px, rgba(59,130,246,0.22) 6px 12px)",
            pointerEvents: "none",
          }}
        />
      ) : null}

      {/* Bottom-margin grabber, straddling the block's bottom edge. */}
      <div
        ref={grabRef}
        onPointerDown={onDown}
        onPointerMove={onDragMove}
        onPointerUp={onDragUp}
        title="Drag to set bottom margin"
        style={{
          position: "fixed",
          left: grabLeft,
          top: view.bottom - GRAB_H / 2,
          width: GRAB_W,
          height: GRAB_H,
          borderRadius: GRAB_H,
          background: "#3b82f6",
          border: "2px solid #fff",
          boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
          cursor: "ns-resize",
          pointerEvents: "auto",
          touchAction: "none",
        }}
      />

      {/* Live readout while dragging — follows the cursor. */}
      {label ? (
        <div
          style={{
            position: "fixed",
            left: label.x,
            top: label.y,
            padding: "2px 8px",
            fontSize: 12,
            fontFamily: "ui-monospace, monospace",
            lineHeight: "20px",
            color: "#fff",
            background: "#3b82f6",
            borderRadius: 4,
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          {label.text}
        </div>
      ) : null}
    </div>
  );
}
