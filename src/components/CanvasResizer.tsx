"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  CH_MAX_WIDTH,
  isResizableType,
  unitFor,
  type MaxWidthUnit,
  type ResizableType,
} from "@/lib/maxWidth";
import { RESIZE_CHANNEL, type ResizeMessage } from "@/lib/previewBridge";

/**
 * On-canvas drag-to-resize for a text block's max width.
 *
 * Mounted only inside the Presentation preview (draft mode). It shows a handle
 * on the right edge of any hovered heading/paragraph; dragging updates the
 * block's `max-width` live (in `ch`) and, on release, broadcasts the final
 * value to the Studio — which owns the write token — to persist to the draft.
 *
 * The preview itself has no write access, so it never touches the dataset; it
 * only mutates the DOM optimistically and lets the committed draft stream back.
 */

type Target = {
  el: HTMLElement;
  type: ResizableType;
  path: string;
  id: string;
};

type Box = { left: number; top: number; width: number; height: number };

const HANDLE_W = 10;
const Z = 2147483000;

/** Width of a "0" glyph in the element's font — the CSS definition of `1ch`. */
let measureCtx: CanvasRenderingContext2D | null = null;
function chPx(el: HTMLElement): number {
  const cs = getComputedStyle(el);
  if (!measureCtx) {
    measureCtx = document.createElement("canvas").getContext("2d");
  }
  if (measureCtx) {
    measureCtx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const w = measureCtx.measureText("0").width;
    if (w > 0) return w;
  }
  return parseFloat(cs.fontSize) * 0.5 || 8;
}

/** Pixels per unit: a "0" glyph for `ch`, the root font-size for `rem`. */
function pxPerUnit(el: HTMLElement, unit: MaxWidthUnit): number {
  if (unit === "rem") {
    const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
    return root > 0 ? root : 16;
  }
  return chPx(el);
}

/** The block's current max width in `unit`, or its rendered width if unset. */
function readCurrent(el: HTMLElement, ppu: number, unit: MaxWidthUnit): number {
  const inline = el.style.maxWidth;
  if (inline.endsWith(unit)) {
    const n = parseFloat(inline);
    if (!Number.isNaN(n)) return n;
  }
  const computed = getComputedStyle(el).maxWidth;
  if (computed && computed !== "none") {
    const n = parseFloat(computed);
    if (!Number.isNaN(n)) return n / ppu;
  }
  return el.getBoundingClientRect().width / ppu;
}

export function CanvasResizer() {
  const [box, setBox] = useState<Box | null>(null);
  const [dragging, setDragging] = useState(false);
  const [label, setLabel] = useState<string | null>(null);

  const targetRef = useRef<Target | null>(null);
  const draggingRef = useRef(false);
  // Value produced by the current drag: a number (ch), `null` (unset →
  // max-width: none), or `undefined` (the pointer hasn't moved yet).
  const liveValueRef = useRef<number | null | undefined>(undefined);
  const handleRef = useRef<HTMLDivElement | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const rafRef = useRef(0);
  const dragRef = useRef<{
    ppu: number;
    unit: MaxWidthUnit;
    startX: number;
    startCh: number;
    range: { min: number; max: number; step: number };
  } | null>(null);

  const reposition = useCallback(() => {
    const el = targetRef.current?.el;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) {
      setBox(null);
      return;
    }
    setBox({ left: r.left, top: r.top, width: r.width, height: r.height });
  }, []);

  const clearTarget = useCallback(() => {
    if (draggingRef.current) return;
    targetRef.current = null;
    setBox(null);
  }, []);

  // Open the resize channel once — used both to broadcast commits (on drag end)
  // and to receive live previews from the Studio's max-width range slider,
  // which we apply straight to the DOM so the canvas tracks the drag.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel(RESIZE_CHANNEL);
    channelRef.current = channel;
    channel.onmessage = (event: MessageEvent<ResizeMessage>) => {
      const msg = event.data;
      if (!msg || msg.type !== "preview" || msg.field !== "maxWidth") return;
      if (draggingRef.current) return; // don't fight an active on-canvas drag
      const el = Array.from(
        document.querySelectorAll<HTMLElement>("[data-sanity-path]"),
      ).find((node) => node.getAttribute("data-sanity-path") === msg.path);
      if (!el) return;
      const type = el.getAttribute("data-sanity-type");
      const unit: MaxWidthUnit = isResizableType(type) ? unitFor(type) : "ch";
      el.style.maxWidth = msg.value === null ? "none" : `${msg.value}${unit}`;
    };
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);

  // Track which resizable block is under the pointer, and keep the handle glued
  // to its right edge as the page scrolls or reflows.
  useEffect(() => {
    // `elementsFromPoint` (not event.target) so we see through the Presentation
    // overlay that paints on top of the page to the real block beneath it.
    const detect = (x: number, y: number) => {
      const stack = document.elementsFromPoint(x, y) as HTMLElement[];
      if (handleRef.current && stack.includes(handleRef.current)) return; // keep
      const block = stack.find((el) => el.hasAttribute?.("data-sanity-type"));
      const type = block?.getAttribute("data-sanity-type");
      if (block && isResizableType(type)) {
        targetRef.current = {
          el: block,
          type,
          path: block.getAttribute("data-sanity-path") || "",
          id: block.getAttribute("data-sanity-id") || "",
        };
        reposition();
      } else {
        clearTarget();
      }
    };

    const onMove = (e: PointerEvent) => {
      if (draggingRef.current) return;
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

  const onDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const target = targetRef.current;
    if (!target) return;
    // Don't let Presentation treat this as a click-to-edit.
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const unit = unitFor(target.type);
    const ppu = pxPerUnit(target.el, unit);
    dragRef.current = {
      ppu,
      unit,
      startX: e.clientX,
      startCh: readCurrent(target.el, ppu, unit),
      range: CH_MAX_WIDTH[target.type],
    };
    liveValueRef.current = undefined;
    draggingRef.current = true;
    setDragging(true);
  }, []);

  const onMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      const target = targetRef.current;
      const d = dragRef.current;
      if (!target || !d) return;
      const deltaCh = (e.clientX - d.startX) / d.ppu;
      // Snap to the field's step (e.g. 0.1ch for headings) and trim float noise.
      const step = d.range.step;
      const decimals = step < 1 ? String(step).split(".")[1].length : 0;
      const next = Number(
        (Math.round((d.startCh + deltaCh) / step) * step).toFixed(decimals),
      );
      // Dragged past the max → drop the constraint entirely (Auto / null).
      const value: number | null =
        next > d.range.max ? null : Math.max(d.range.min, next);
      target.el.style.maxWidth = value === null ? "none" : `${value}${d.unit}`;
      liveValueRef.current = value;
      setLabel(value === null ? "Auto" : `${value}${d.unit}`);
      // Mirror the live value to the Studio so its range slider tracks the drag
      // in real time (canvas→studio). The draft is still written only on release
      // (see `onUp`), so we don't hit Sanity's patch throttle mid-drag.
      channelRef.current?.postMessage({
        type: "preview",
        path: target.path,
        field: "maxWidth",
        value,
      } satisfies ResizeMessage);
      reposition();
    },
    [reposition],
  );

  const onUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    setLabel(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // capture already gone — ignore
    }
    const target = targetRef.current;
    const value = liveValueRef.current;
    // `undefined` means the pointer never moved — don't write anything. `null`
    // is a real value here (unset the max width).
    if (target && value !== undefined) {
      channelRef.current?.postMessage({
        type: "commit",
        id: target.id,
        path: target.path,
        field: "maxWidth",
        value,
      } satisfies ResizeMessage);
    }
    liveValueRef.current = undefined;
  }, []);

  if (!box) return null;

  const handleH = Math.max(24, Math.min(box.height, 48));
  const edgeX = box.left + box.width;
  const centerY = box.top + box.height / 2;
  // The 3D logo has its own on-canvas UI (rotation gizmo) filling the square, so
  // the full outline box just reads as clutter there — show only the handle.
  const showOutline = targetRef.current?.type !== "logo3d";

  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: Z }}>
      {/* Outline of the block being resized. */}
      {showOutline ? (
        <div
          style={{
            position: "fixed",
            left: box.left,
            top: box.top,
            width: box.width,
            height: box.height,
            border: `1px solid rgba(59,130,246,${dragging ? 0.9 : 0.45})`,
            borderRadius: 3,
            boxSizing: "border-box",
            pointerEvents: "none",
          }}
        />
      ) : null}
      {/* The drag handle, straddling the right edge. */}
      <div
        ref={handleRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        title="Drag to set max width"
        style={{
          position: "fixed",
          left: edgeX - HANDLE_W / 2,
          top: centerY - handleH / 2,
          width: HANDLE_W,
          height: handleH,
          borderRadius: HANDLE_W,
          background: "#3b82f6",
          border: "2px solid #fff",
          boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
          cursor: "ew-resize",
          pointerEvents: "auto",
          touchAction: "none",
        }}
      />
      {/* Live readout while dragging. */}
      {dragging && label ? (
        <div
          style={{
            position: "fixed",
            left: edgeX + 10,
            top: centerY - 12,
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
          {label}
        </div>
      ) : null}
    </div>
  );
}
