"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDocuments } from "@sanity/visual-editing/react";
import { at, set } from "@sanity/mutate";

import { snapSpacing, type SpacingStep } from "@/lib/spacingScale";
import {
  SECTION_PAD_CSS,
  SECTION_PAD_TOP_TOKENS,
  SECTION_PAD_BOTTOM_TOKENS,
  resolveSectionPadScale,
  type SectionPadToken,
} from "@/lib/sectionSpacing";

/**
 * On-canvas TOP + BOTTOM padding handles for a Section — the section-level
 * sibling of `BlockMarginResizer`. Hovering a section's own area (its padding /
 * empty space, NOT a child block) shows a shaded band over each vertical
 * padding with a grabber at the inner (content) edge; dragging snaps through the
 * named section-padding scale (None … Large, plus "Page top" on the TOP edge
 * only) and commits the token to `paddingTop` / `paddingBottom` on release via
 * the optimistic document store. Mounted only inside the Presentation preview.
 *
 * We only engage when the section is the TOPMOST editable element under the
 * pointer, so hovering a block inside it hands off to the block handles instead.
 * The padding lives on the section's `.section__container`, so we read/measure
 * that element while committing to the section's own `data-sanity-*` path.
 */

const Z = 2147483000;
const GRAB_W = 56;
const GRAB_H = 8;
const STRIPES =
  "repeating-linear-gradient(-45deg, rgba(59,130,246,0.12) 0 6px, rgba(59,130,246,0.22) 6px 12px)";

type Edge = "top" | "bottom";
type Target = { containerEl: HTMLElement; path: string; id: string };
type View = {
  left: number;
  width: number;
  containerTop: number;
  containerBottom: number;
  topPx: number;
  bottomPx: number;
};
type Drag = {
  edge: Edge;
  startY: number;
  startPx: number;
  scale: SpacingStep[];
  // Fixed anchor the band grows from: the section's top edge for the top band,
  // the content's bottom edge for the bottom band (both stable as padding grows).
  anchor: number;
};

export function SectionSpacingResizer() {
  const { getDocument } = useDocuments();
  const getDocumentRef = useRef(getDocument);
  getDocumentRef.current = getDocument;

  const [view, setView] = useState<View | null>(null);
  const [label, setLabel] = useState<{ text: string; x: number; y: number } | null>(
    null,
  );
  // Which edge is mid-drag (null when idle). During a drag we render only that
  // edge — the other one shifts as the section grows, so its cached box is stale.
  const [activeEdge, setActiveEdge] = useState<Edge | null>(null);

  const targetRef = useRef<Target | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const liveTokenRef = useRef<string | null>(null);
  const topGrabRef = useRef<HTMLDivElement | null>(null);
  const bottomGrabRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef(0);

  const reposition = useCallback(() => {
    if (dragRef.current) return; // pointer drives the visuals mid-drag
    const container = targetRef.current?.containerEl;
    if (!container) {
      setView(null);
      return;
    }
    const r = container.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) {
      setView(null);
      return;
    }
    const cs = getComputedStyle(container);
    setView({
      left: r.left,
      width: r.width,
      containerTop: r.top,
      containerBottom: r.bottom,
      topPx: parseFloat(cs.paddingTop) || 0,
      bottomPx: parseFloat(cs.paddingBottom) || 0,
    });
  }, []);

  const clearTarget = useCallback(() => {
    if (dragRef.current) return;
    targetRef.current = null;
    setView(null);
  }, []);

  // Engage only when the SECTION is the topmost editable element under the
  // pointer (its padding / empty area). Over a child block the topmost editable
  // is that block, so we bow out and let the block handles take over.
  useEffect(() => {
    const detect = (x: number, y: number) => {
      const stack = document.elementsFromPoint(x, y) as HTMLElement[];
      if (
        (topGrabRef.current && stack.includes(topGrabRef.current)) ||
        (bottomGrabRef.current && stack.includes(bottomGrabRef.current))
      )
        return; // over a handle → keep the current target
      const topmost = stack.find((el) => el.hasAttribute?.("data-sanity-type"));
      if (topmost?.getAttribute("data-sanity-type") === "section") {
        const containerEl =
          topmost.querySelector<HTMLElement>(".section__container");
        if (containerEl) {
          targetRef.current = {
            containerEl,
            path: topmost.getAttribute("data-sanity-path") || "",
            id: topmost.getAttribute("data-sanity-id") || "",
          };
          reposition();
          return;
        }
      }
      clearTarget();
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

  const commit = useCallback((edge: Edge, token: string) => {
    const target = targetRef.current;
    if (!target?.path || !target.id) return;
    const field = edge === "top" ? "paddingTop" : "paddingBottom";
    try {
      getDocumentRef.current(target.id).patch([
        at(`${target.path}.${field}`, set(token)),
      ]);
    } catch {
      // no optimistic actor (not in Presentation) — ignore
    }
  }, []);

  const onDown = (edge: Edge) => (e: React.PointerEvent<HTMLDivElement>) => {
    const target = targetRef.current;
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = target.containerEl.getBoundingClientRect();
    const cs = getComputedStyle(target.containerEl);
    const bottomPx = parseFloat(cs.paddingBottom) || 0;
    const startPx =
      edge === "top" ? parseFloat(cs.paddingTop) || 0 : bottomPx;
    dragRef.current = {
      edge,
      startY: e.clientY,
      startPx,
      scale: resolveSectionPadScale(
        edge === "top" ? SECTION_PAD_TOP_TOKENS : SECTION_PAD_BOTTOM_TOKENS,
      ),
      // Top band grows down from the section top; bottom band grows down from
      // the content's bottom edge (r.bottom minus the current bottom padding).
      anchor: edge === "top" ? r.top : r.bottom - bottomPx,
    };
    liveTokenRef.current = null;
    setActiveEdge(edge);
  };

  const onDragMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    const target = targetRef.current;
    if (!d || !target) return;
    // Drag down = more padding on either edge; up = less (toward 0).
    const snapped = snapSpacing(d.scale, Math.max(0, d.startPx + (e.clientY - d.startY)));
    const prop: "paddingTop" | "paddingBottom" =
      d.edge === "top" ? "paddingTop" : "paddingBottom";
    // Apply the token's real (responsive) CSS var so the canvas matches render.
    target.containerEl.style[prop] = SECTION_PAD_CSS[snapped.token as SectionPadToken];
    liveTokenRef.current = snapped.token;
    setLabel({
      text: `${d.edge === "top" ? "Top" : "Bottom"} · ${snapped.token.toUpperCase()}`,
      x: e.clientX + 14,
      y: e.clientY - 10,
    });
    setView((prev) => {
      if (!prev) return prev;
      return d.edge === "top"
        ? { ...prev, topPx: snapped.px }
        : { ...prev, bottomPx: snapped.px, containerBottom: d.anchor + snapped.px };
    });
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
      if (token) commit(d.edge, token);
      dragRef.current = null;
      liveTokenRef.current = null;
      setActiveEdge(null);
      setLabel(null);
      reposition();
    },
    [commit, reposition],
  );

  if (!view) return null;

  const showTop = activeEdge === null || activeEdge === "top";
  const showBottom = activeEdge === null || activeEdge === "bottom";
  const contentTop = view.containerTop + view.topPx;
  const contentBottom = view.containerBottom - view.bottomPx;
  const grabLeft = view.left + view.width / 2 - GRAB_W / 2;

  const handle = (ref: React.RefObject<HTMLDivElement | null>, edge: Edge, y: number) => (
    <div
      ref={ref}
      onPointerDown={onDown(edge)}
      onPointerMove={onDragMove}
      onPointerUp={onDragUp}
      title={`Drag to set ${edge} padding`}
      style={{
        position: "fixed",
        left: grabLeft,
        top: y - GRAB_H / 2,
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
  );

  const band = (top: number, height: number) => (
    <div
      style={{
        position: "fixed",
        left: view.left,
        top,
        width: view.width,
        height,
        background: STRIPES,
        pointerEvents: "none",
      }}
    />
  );

  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: Z }}>
      {showTop && view.topPx > 0 ? band(view.containerTop, view.topPx) : null}
      {showBottom && view.bottomPx > 0 ? band(contentBottom, view.bottomPx) : null}

      {/* Each grabber sits on the band edge that MOVES when its padding grows —
          the content edge for the top band, the section's outer edge for the
          bottom band — so dragging down always grows the padding and the handle
          tracks the cursor (top: content pushed down; bottom: section extends). */}
      {showTop ? handle(topGrabRef, "top", contentTop) : null}
      {showBottom ? handle(bottomGrabRef, "bottom", view.containerBottom) : null}

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
