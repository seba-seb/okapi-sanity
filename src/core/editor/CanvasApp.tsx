import { useEffect, useRef, useState } from "react";

import { PageBuilder } from "@/core/render/PageBuilder";
import { PAGE_QUERY } from "@/core/sanity/queries";
import type { Routes } from "@/core/lib/routes";
import type { Page } from "@/core/lib/types";

import { listen, post, type ToCanvas } from "./protocol";
import { installStaleChunkReload } from "@/core/lib/staleChunkReload";

installStaleChunkReload();

const EMPTY = {};

type Box = { top: number; left: number; width: number; height: number; label: string } | null;

function boxOf(el: Element | null): Box {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height, label: el.getAttribute("data-sanity-title") ?? "" };
}

const byPath = (path: string | null) =>
  path ? [...document.querySelectorAll("[data-sanity-path]")].find((n) => n.getAttribute("data-sanity-path") === path) ?? null : null;

/**
 * The editor's canvas: the real PageBuilder rendering whatever document the
 * parent editor posts, plus our own hover/selection overlay. Clicks never
 * navigate — they select the nearest block and tell the editor.
 */
export function CanvasApp() {
  const [doc, setDoc] = useState<Page | null>(null);
  const [routes, setRoutes] = useState<Routes>({});
  const [selected, setSelected] = useState<string | null>(null);
  const hoverEl = useRef<Element | null>(null);
  const [hover, setHover] = useState<Box>(null);
  const [sel, setSel] = useState<Box>(null);

  useEffect(() => {
    const off = listen<ToCanvas>((msg) => {
      if (msg.type === "render") {
        setDoc(msg.doc);
        setRoutes(msg.routes);
      } else if (msg.type === "select") setSelected(msg.path);
    });
    post(window.parent, { type: "ready" });
    return off;
  }, []);

  // Select on click; never follow links or submit anything inside the canvas.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const el = (e.target as Element).closest("[data-sanity-path]");
      const path = el?.getAttribute("data-sanity-path") ?? null;
      setSelected(path);
      post(window.parent, { type: "select", path });
    };
    const onMove = (e: MouseEvent) => {
      hoverEl.current = (e.target as Element).closest("[data-sanity-path]");
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("mouseleave", () => (hoverEl.current = null));
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("mousemove", onMove, true);
    };
  }, []);

  // ponytail: one rAF loop measures two boxes per frame — survives scroll,
  // resize, pins and live re-renders without wiring observers to each.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      setHover(boxOf(hoverEl.current));
      setSel(boxOf(byPath(selected)));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [selected]);

  if (!doc) return <p style={{ padding: 32, font: "14px system-ui", opacity: 0.6 }}>Waiting for the editor…</p>;

  return (
    <>
      {doc.sections?.length ? (
        <PageBuilder page={doc} query={PAGE_QUERY} params={EMPTY} routes={routes} />
      ) : (
        <p style={{ padding: 32, font: "14px system-ui", opacity: 0.6 }}>This page has no sections yet.</p>
      )}
      <Outline box={hover} color="#6b8cff" dashed />
      <Outline box={sel} color="#2f5bff" />
    </>
  );
}

function Outline({ box, color, dashed }: { box: Box; color: string; dashed?: boolean }) {
  if (!box || box.width === 0) return null;
  return (
    <div
      style={{
        position: "fixed",
        top: box.top,
        left: box.left,
        width: box.width,
        height: box.height,
        outline: `${dashed ? 1 : 2}px ${dashed ? "dashed" : "solid"} ${color}`,
        outlineOffset: -1,
        pointerEvents: "none",
        zIndex: 2147483646,
      }}
    >
      {!dashed && box.label ? (
        <span style={{ position: "absolute", top: box.top > 20 ? -20 : 0, left: -1, background: color, color: "#fff", font: "600 11px/18px system-ui", padding: "0 6px", borderRadius: "3px 3px 0 0", whiteSpace: "nowrap" }}>
          {box.label}
        </span>
      ) : null}
    </div>
  );
}
