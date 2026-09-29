"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDocuments } from "@sanity/visual-editing/react";
import { at, set } from "@sanity/mutate";

import { GAP_SCALE, MARGIN_SCALE, snapSpacing as snap } from "@/lib/spacingScale";

/**
 * On-canvas spacing handles for a Button Group — the sibling of `CanvasResizer`
 * (text max-width). Hovering a group shows:
 *
 *   • a translucent band in the GAP between its first two buttons — drag to snap
 *     the gap across the 6 core tokens (XS…2XL);
 *   • a grabber at the group's TOP edge with a shaded band for the current top
 *     margin — drag down for more space / up for less, snapping the full scale
 *     including None (0).
 *
 * Both preview live and commit the chosen token to the group's `gap` /
 * `marginTop` field on release via the optimistic document store. Mounted only
 * inside the Presentation preview (draft mode); renders nothing when idle.
 */

const Z = 2147483000;
const MARGIN_GRAB_W = 56;
const MARGIN_GRAB_H = 8;

type Target = { el: HTMLElement; path: string; id: string };

type GapRect = {
  left: number;
  top: number;
  width: number;
  height: number;
  axis: "x" | "y";
};
type MarginView = {
  groupLeft: number;
  groupTop: number;
  groupWidth: number;
  marginPx: number;
};
type View = { gap: GapRect | null; margin: MarginView };

type Drag =
  | { kind: "gap"; startPos: number; startGap: number; axis: "x" | "y" }
  | { kind: "margin"; startY: number; startMargin: number; yAbove: number };

export function SpacingResizer() {
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
  const gapElRef = useRef<HTMLDivElement | null>(null);
  const marginElRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef(0);

  const reposition = useCallback(() => {
    if (dragRef.current) return; // pointer drives the visuals mid-drag
    const el = targetRef.current?.el;
    if (!el) {
      setView(null);
      return;
    }
    const g = el.getBoundingClientRect();
    const marginPx = parseFloat(getComputedStyle(el).marginTop) || 0;

    let gap: GapRect | null = null;
    const btns = el.querySelectorAll<HTMLElement>('[data-sanity-type="button"]');
    if (btns.length >= 2) {
      const a = btns[0].getBoundingClientRect();
      const b = btns[1].getBoundingClientRect();
      if (b.top >= a.bottom - 1) {
        // Stacked (column) → horizontal band in the vertical gap.
        gap = {
          left: Math.min(a.left, b.left),
          top: a.bottom,
          width: Math.max(a.width, b.width),
          height: Math.max(2, b.top - a.bottom),
          axis: "y",
        };
      } else {
        // Side by side (row) → vertical band in the horizontal gap.
        gap = {
          left: a.right,
          top: Math.min(a.top, b.top),
          width: Math.max(2, b.left - a.right),
          height: Math.max(a.height, b.height),
          axis: "x",
        };
      }
    }

    setView({
      gap,
      margin: {
        groupLeft: g.left,
        groupTop: g.top,
        groupWidth: g.width,
        marginPx,
      },
    });
  }, []);

  const clearTarget = useCallback(() => {
    if (dragRef.current) return;
    targetRef.current = null;
    setView(null);
  }, []);

  // Track which button group is under the pointer.
  useEffect(() => {
    const detect = (x: number, y: number) => {
      const stack = document.elementsFromPoint(x, y) as HTMLElement[];
      // Keep the target while over our own handles.
      if (
        (gapElRef.current && stack.includes(gapElRef.current)) ||
        (marginElRef.current && stack.includes(marginElRef.current))
      ) {
        return;
      }
      const group = stack.find(
        (el) => el.getAttribute?.("data-sanity-type") === "buttonWrapper",
      );
      if (group) {
        targetRef.current = {
          el: group,
          path: group.getAttribute("data-sanity-path") || "",
          id: group.getAttribute("data-sanity-id") || "",
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
      if (rafRef.current) return;
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

  const commit = useCallback((field: "gap" | "marginTop", token: string) => {
    const target = targetRef.current;
    if (!target?.path || !target.id) return;
    try {
      getDocumentRef.current(target.id).patch([
        at(`${target.path}.${field}`, set(token)),
      ]);
    } catch {
      // no optimistic actor (not in Presentation) — ignore
    }
  }, []);

  // ---- Gap drag ----
  const onGapDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const target = targetRef.current;
      const gap = view?.gap;
      if (!target || !gap) return;
      e.preventDefault();
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        kind: "gap",
        startPos: gap.axis === "x" ? e.clientX : e.clientY,
        startGap: parseFloat(getComputedStyle(target.el).columnGap) || 0,
        axis: gap.axis,
      };
      liveTokenRef.current = null;
    },
    [view],
  );

  // ---- Margin drag ----
  const onMarginDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const target = targetRef.current;
    if (!target) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const g = target.el.getBoundingClientRect();
    const startMargin = parseFloat(getComputedStyle(target.el).marginTop) || 0;
    dragRef.current = {
      kind: "margin",
      startY: e.clientY,
      startMargin,
      yAbove: g.top - startMargin, // fixed bottom of the element above
    };
    liveTokenRef.current = null;
  }, []);

  const onDragMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    const target = targetRef.current;
    if (!d || !target) return;

    if (d.kind === "gap") {
      const pos = d.axis === "x" ? e.clientX : e.clientY;
      const snapped = snap(GAP_SCALE, Math.max(0, d.startGap + (pos - d.startPos)));
      target.el.style.gap = `${snapped.px}px`;
      liveTokenRef.current = snapped.token;
      setLabel({
        text: `Gap · ${snapped.token.toUpperCase()}`,
        x: e.clientX + 14,
        y: e.clientY - 10,
      });
      // Re-glue the band to the now-resized gap.
      const btns = target.el.querySelectorAll<HTMLElement>(
        '[data-sanity-type="button"]',
      );
      if (btns.length >= 2) {
        const a = btns[0].getBoundingClientRect();
        const b = btns[1].getBoundingClientRect();
        setView((prev) =>
          prev
            ? {
                ...prev,
                gap:
                  d.axis === "x"
                    ? {
                        left: a.right,
                        top: Math.min(a.top, b.top),
                        width: Math.max(2, b.left - a.right),
                        height: Math.max(a.height, b.height),
                        axis: "x",
                      }
                    : {
                        left: Math.min(a.left, b.left),
                        top: a.bottom,
                        width: Math.max(a.width, b.width),
                        height: Math.max(2, b.top - a.bottom),
                        axis: "y",
                      },
              }
            : prev,
        );
      }
      return;
    }

    // margin: drag down = more space above, up = less (toward 0)
    const snapped = snap(MARGIN_SCALE, Math.max(0, d.startMargin + (e.clientY - d.startY)));
    target.el.style.marginTop = `${snapped.px}px`;
    liveTokenRef.current = snapped.token;
    setLabel({
      text: `Top · ${snapped.token.toUpperCase()}`,
      x: e.clientX + 14,
      y: e.clientY - 10,
    });
    setView((prev) =>
      prev
        ? { ...prev, margin: { ...prev.margin, groupTop: d.yAbove + snapped.px, marginPx: snapped.px } }
        : prev,
    );
  }, []);

  const onDragUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      if (!d) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      const token = liveTokenRef.current;
      if (token) commit(d.kind === "gap" ? "gap" : "marginTop", token);
      dragRef.current = null;
      liveTokenRef.current = null;
      setLabel(null);
      reposition();
    },
    [commit, reposition],
  );

  if (!view) return null;

  const { gap, margin } = view;
  const marginGrabberLeft = margin.groupLeft + margin.groupWidth / 2 - MARGIN_GRAB_W / 2;

  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: Z }}>
      {/* Gap band — enlarged to a min hit size, centered on the real gap. */}
      {gap
        ? (() => {
            const bandW = Math.max(gap.width, 8);
            const bandH = Math.max(gap.height, 8);
            return (
              <div
                ref={gapElRef}
                onPointerDown={onGapDown}
                onPointerMove={onDragMove}
                onPointerUp={onDragUp}
                title="Drag to set gap"
                style={{
                  position: "fixed",
                  left: gap.left - (bandW - gap.width) / 2,
                  top: gap.top - (bandH - gap.height) / 2,
                  width: bandW,
                  height: bandH,
                  background: "rgba(59,130,246,0.28)",
                  outline: "1px solid rgba(59,130,246,0.8)",
                  outlineOffset: -1,
                  borderRadius: 2,
                  cursor: gap.axis === "x" ? "ew-resize" : "ns-resize",
                  pointerEvents: "auto",
                  touchAction: "none",
                }}
              />
            );
          })()
        : null}

      {/* Top-margin shaded region (visual only). */}
      {margin.marginPx > 0 ? (
        <div
          style={{
            position: "fixed",
            left: margin.groupLeft,
            top: margin.groupTop - margin.marginPx,
            width: margin.groupWidth,
            height: margin.marginPx,
            background:
              "repeating-linear-gradient(-45deg, rgba(59,130,246,0.12) 0 6px, rgba(59,130,246,0.22) 6px 12px)",
            pointerEvents: "none",
          }}
        />
      ) : null}

      {/* Top-margin grabber. */}
      <div
        ref={marginElRef}
        onPointerDown={onMarginDown}
        onPointerMove={onDragMove}
        onPointerUp={onDragUp}
        title="Drag to set top margin"
        style={{
          position: "fixed",
          left: marginGrabberLeft,
          top: margin.groupTop - MARGIN_GRAB_H / 2,
          width: MARGIN_GRAB_W,
          height: MARGIN_GRAB_H,
          borderRadius: MARGIN_GRAB_H,
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
