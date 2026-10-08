import { useEffect, useMemo, useRef, useState } from "react";

import { PageBuilder } from "@/core/render/PageBuilder";
import { resolveSelection } from "@/core/editor/paths";
import type { Routes } from "@/core/lib/routes";
import type { Components } from "@/core/render/components";
import type { Page } from "@/core/lib/types";
import { installStaleChunkReload } from "@/core/lib/staleChunkReload";

import { listen, post, type ToCanvas } from "./protocol";
import { htmlToPt, ptPlain, ptToHtml } from "./richtext";
import { applyOverrides, splitInstancePath, type Override } from "@/core/render/overrides";

installStaleChunkReload();

const EMPTY = {};

/** Which text in each block can be edited in place (selector inside the block, or the block itself). */
const TEXT_TARGETS: Record<string, { sel?: string; field: string; kind: "pt" | "string"; multiline?: boolean }[]> = {
  heading: [{ field: "text", kind: "pt" }],
  paragraph: [{ field: "text", kind: "pt", multiline: true }],
  eyebrow: [{ field: "text", kind: "string" }],
  button: [{ sel: ".btn__label", field: "label", kind: "string" }],
  card: [
    { sel: ".card__title", field: "heading", kind: "string" },
    { sel: ".card__text", field: "body", kind: "string", multiline: true },
  ],
  bigType: [{ field: "text", kind: "string" }],
  textScrub: [{ field: "text", kind: "string", multiline: true }],
};
/** Blocks that take a dropped image file, and the field it goes to. */
const IMAGE_FIELDS: Record<string, string> = { imageBlock: "image", card: "image", parallaxMedia: "image", section: "backgroundImage" };

type Box = { top: number; left: number; width: number; height: number; label: string } | null;
const boxOf = (el: Element | null): Box => {
  if (!el?.isConnected) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height, label: el.getAttribute("data-sanity-title") ?? "" };
};
const sameBox = (a: Box, b: Box) => a === b || (!!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height && a.label === b.label);
const byPath = (path: string | null) =>
  path ? ([...document.querySelectorAll("[data-sanity-path]")].find((n) => n.getAttribute("data-sanity-path") === path) ?? null) : null;

/** Exact DOM snapshot — same node objects + text — so React's nodes can be put back untouched after an edit. */
type Snap = { node: Node; text?: string | null; children: Snap[] };
const snapshot = (n: Node): Snap => ({ node: n, text: n.nodeType === Node.TEXT_NODE ? n.nodeValue : undefined, children: [...n.childNodes].map(snapshot) });
function restore(s: Snap) {
  if (s.node.nodeType === Node.TEXT_NODE) s.node.nodeValue = s.text ?? "";
  else (s.node as Element).replaceChildren(...s.children.map((c) => (restore(c), c.node)));
}

/**
 * The editor's canvas: the real PageBuilder rendering whatever document the
 * parent editor posts, plus our own overlay. Click selects, double-click edits
 * text in place, dropping an image file on an image block uploads it.
 */
export function CanvasApp() {
  const [doc, setDoc] = useState<Page | null>(null);
  const [routes, setRoutes] = useState<Routes>({});
  const [components, setComponents] = useState<Components>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [others, setOthers] = useState<string[]>([]); // the rest of a multi-selection
  const docRef = useRef<Page | null>(null);
  docRef.current = doc;
  const componentsRef = useRef<Components>({});
  componentsRef.current = components;
  /** A field's current value — for blocks inside an instance, the component's value with overrides applied. */
  const valueAt = (path: string, field: string): unknown => {
    const d = docRef.current;
    if (!d) return undefined;
    const inst = splitInstancePath(path);
    if (!inst) return resolveSelection(d, path)?.item?.[field];
    const ref = resolveSelection(d, inst.instancePath)?.item as { component?: { _ref?: string }; overrides?: Override[] } | undefined;
    const sections = applyOverrides(componentsRef.current[ref?.component?._ref ?? ""]?.sections ?? [], ref?.overrides);
    let found: unknown;
    const walk = (v: unknown) => {
      if (found !== undefined || !v || typeof v !== "object") return;
      if (Array.isArray(v)) return v.forEach(walk);
      const o = v as Record<string, unknown>;
      if (o._key === inst.blockKey) found = o[field] ?? null;
      else Object.values(o).forEach(walk);
    };
    walk(sections);
    return found ?? undefined;
  };
  // While a text edit is open, renders from the editor wait here (React must
  // not rewrite the nodes the user is typing into).
  const editing = useRef<null | {
    finish: (commit: boolean) => void;
    el: HTMLElement;
    rich: boolean;
    command: (name: "bold" | "italic" | "link" | "unlink") => void;
  }>(null);
  const pending = useRef<{ doc: Page; routes: Routes; components: Components } | null>(null);
  const hoverEl = useRef<Element | null>(null);
  const dropEl = useRef<Element | null>(null);
  const [replayKey, setReplayKey] = useState(0);
  const [boxes, setBoxes] = useState<{ hover: Box; sel: Box; drop: Box; bar: Box; multi: Box[] }>({ hover: null, sel: null, drop: null, bar: null, multi: [] });

  useEffect(() => {
    const off = listen<ToCanvas>((msg) => {
      if (msg.type === "render") {
        if (editing.current) pending.current = { doc: msg.doc, routes: msg.routes, components: msg.components };
        else {
          setDoc(msg.doc);
          setRoutes(msg.routes);
          setComponents(msg.components);
        }
      } else if (msg.type === "replay") {
        (globalThis as { __remarkableReplay?: boolean }).__remarkableReplay = true;
        setReplayKey((k) => k + 1);
      } else if (msg.type === "select") {
        setSelected(msg.path);
        setOthers((msg.paths ?? []).filter((p) => p !== msg.path));
        if (msg.scroll) byPath(msg.path)?.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    });
    post(window.parent, { type: "ready" });
    return off;
  }, []);

  useEffect(() => {
    // Inside a component instance, the instance itself is the block (its inner
    // blocks belong to the component document).
    const blockAt = (t: EventTarget | null) =>
      t instanceof Element ? (t.closest("[data-instance]") ?? t.closest("[data-sanity-path]")) : null;

    const onClick = (e: MouseEvent) => {
      if (editing.current && (e.target as Element).closest("[contenteditable]")) return; // clicking inside the edit
      e.preventDefault();
      e.stopPropagation();
      editing.current?.finish(true);
      const path = blockAt(e.target)?.getAttribute("data-sanity-path") ?? null;
      if ((e.shiftKey || e.metaKey || e.ctrlKey) && path) {
        post(window.parent, { type: "select", path, add: true }); // the editor echoes the new selection
        return;
      }
      setSelected(path);
      setOthers([]);
      post(window.parent, { type: "select", path });
    };

    const onDblClick = (e: MouseEvent) => {
      // Inside an instance the inner block is the target (its edit becomes an override).
      const block = (e.target as Element).closest("[data-sanity-path]");
      const path = block?.getAttribute("data-sanity-path");
      const type = block?.getAttribute("data-sanity-type") ?? "";
      if (!block || !path || editing.current) return;
      const targets = TEXT_TARGETS[type];
      const target = targets?.find((t) => (t.sel ? (e.target as Element).closest(t.sel) : true));
      if (!target) return;
      const el = (target.sel ? (e.target as Element).closest(target.sel) : block) as HTMLElement | null;
      if (!el || !block.contains(el)) return;
      const current = valueAt(path, target.field);
      e.preventDefault();
      startEdit(el, path, target.field, target.kind, !!target.multiline, current);
    };

    /**
     * Strings edit as plain text. Rich text (Portable Text) edits with bold /
     * italic / links: the element shows HTML we generate from the PT (links
     * tagged with their markDef key), and is parsed back to PT on every input.
     * Either way React's own DOM is snapshotted first and restored after.
     */
    const startEdit = (el: HTMLElement, path: string, field: string, kind: "pt" | "string", multiline: boolean, current: unknown) => {
      const snap = snapshot(el);
      const rich = kind === "pt";
      const original = rich ? JSON.stringify(current ?? []) : el.innerText;
      let timer: number | undefined;
      let suspendBlur = false;
      const pt = () => htmlToPt(el, current);
      const value = () => (rich ? JSON.stringify(pt()) : el.innerText.replace(/\n+$/, ""));
      const send = (final: boolean) => {
        if (!rich) return post(window.parent, { type: "text", path, field, kind, value: value(), final });
        const blocks = pt();
        post(window.parent, { type: "text", path, field, kind, value: ptPlain(blocks), pt: blocks, final });
      };
      const onInput = () => {
        clearTimeout(timer);
        timer = window.setTimeout(() => send(false), 250);
      };
      const command = (name: "bold" | "italic" | "link" | "unlink") => {
        if (!rich) return;
        if (name === "link") {
          const sel = window.getSelection();
          const range = sel?.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
          suspendBlur = true;
          const url = window.prompt("Link URL", "https://");
          suspendBlur = false;
          el.focus();
          if (range) {
            sel!.removeAllRanges();
            sel!.addRange(range);
          }
          if (url) document.execCommand("createLink", false, url);
        } else document.execCommand(name);
        onInput();
      };
      const onKey = (e: KeyboardEvent) => {
        e.stopPropagation();
        const mod = e.metaKey || e.ctrlKey;
        if (e.key === "Escape") finish(false);
        else if (rich && mod && e.key.toLowerCase() === "k") {
          e.preventDefault();
          command("link");
        } else if (e.key === "Enter" && (rich ? !multiline : !(multiline && e.shiftKey))) {
          // Headings/labels: Enter commits. Rich paragraphs: Enter = new paragraph.
          e.preventDefault();
          finish(true);
        }
      };
      const finish = (commit: boolean) => {
        clearTimeout(timer);
        el.removeEventListener("input", onInput);
        el.removeEventListener("keydown", onKey);
        el.removeEventListener("blur", onBlur);
        el.removeAttribute("contenteditable");
        if (commit && value() !== original) send(true);
        else if (!commit)
          post(window.parent, rich
            ? { type: "text", path, field, kind, value: "", pt: JSON.parse(original), final: true }
            : { type: "text", path, field, kind, value: original, final: true });
        restore(snap); // React's own nodes, exactly as React left them
        editing.current = null;
        const p = pending.current;
        pending.current = null;
        if (p) {
          setDoc(p.doc);
          setRoutes(p.routes);
          setComponents(p.components);
        }
      };
      const onBlur = () => !suspendBlur && finish(true);
      if (rich) {
        el.innerHTML = ptToHtml(current);
        el.setAttribute("contenteditable", "true");
      } else {
        el.setAttribute("contenteditable", "plaintext-only");
        if (el.contentEditable !== "plaintext-only") el.setAttribute("contenteditable", "true"); // Firefox < 136
      }
      el.addEventListener("input", onInput);
      el.addEventListener("keydown", onKey);
      el.addEventListener("blur", onBlur);
      editing.current = { finish, el, rich, command };
      el.focus();
    };

    const onMove = (e: MouseEvent) => (hoverEl.current = blockAt(e.target));
    const imageTarget = (t: EventTarget | null) => {
      // Inside an instance: the inner image block (the drop becomes an override).
      let el = t instanceof Element ? t.closest("[data-sanity-path]") : null;
      while (el && !IMAGE_FIELDS[el.getAttribute("data-sanity-type") ?? ""]) el = el.parentElement?.closest("[data-sanity-path]") ?? null;
      return el;
    };
    const onDragOver = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      const el = imageTarget(e.target);
      dropEl.current = el;
      if (el) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }
    };
    const onDrop = (e: DragEvent) => {
      const el = imageTarget(e.target);
      dropEl.current = null;
      const file = [...(e.dataTransfer?.files ?? [])].find((f) => f.type.startsWith("image/"));
      if (!el || !file) return;
      e.preventDefault();
      const path = el.getAttribute("data-sanity-path")!;
      post(window.parent, { type: "drop", path, field: IMAGE_FIELDS[el.getAttribute("data-sanity-type")!], file });
      setSelected(path);
      post(window.parent, { type: "select", path });
    };
    const onDragLeave = (e: DragEvent) => {
      if (!e.relatedTarget) dropEl.current = null;
    };
    const onKey = (e: KeyboardEvent) => {
      if (editing.current) return;
      const mod = e.metaKey || e.ctrlKey;
      const handled = e.key === "Delete" || e.key === "Backspace" || e.key === "Escape" || (e.altKey && /^Arrow(Up|Down)$/.test(e.key)) || (mod && /^[dzcvy]$/i.test(e.key));
      if (!handled) return;
      e.preventDefault();
      post(window.parent, { type: "key", key: e.key, mod, shift: e.shiftKey, alt: e.altKey });
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("dblclick", onDblClick, true);
    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("dragover", onDragOver, true);
    document.addEventListener("drop", onDrop, true);
    document.addEventListener("dragleave", onDragLeave, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("dblclick", onDblClick, true);
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("dragover", onDragOver, true);
      document.removeEventListener("drop", onDrop, true);
      document.removeEventListener("dragleave", onDragLeave, true);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // ponytail: one rAF loop measures three boxes per frame (only re-renders when
  // they move) — survives scroll, pins and live re-renders with no per-element observers.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const next = {
        hover: boxOf(hoverEl.current),
        sel: boxOf(byPath(selected)),
        drop: boxOf(dropEl.current),
        bar: editing.current?.rich ? boxOf(editing.current.el) : null,
        multi: others.map((p) => boxOf(byPath(p))),
      };
      setBoxes((cur) =>
        sameBox(cur.hover, next.hover) &&
        sameBox(cur.sel, next.sel) &&
        sameBox(cur.drop, next.drop) &&
        sameBox(cur.bar, next.bar) &&
        cur.multi.length === next.multi.length &&
        cur.multi.every((b, i) => sameBox(b, next.multi[i]))
          ? cur
          : next,
      );
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [selected, others]);

  // Animations are created on mount (layout effects); by the time this effect
  // runs they exist, so later remounts (edits) go back to the still canvas.
  useEffect(() => {
    if (replayKey) (globalThis as { __remarkableReplay?: boolean }).__remarkableReplay = false;
  }, [replayKey]);

  // Re-render the page only when the document changes, not on overlay moves.
  const page = useMemo(
    () => (doc?.sections?.length ? <PageBuilder key={replayKey} page={doc} routes={routes} components={components} /> : null),
    [doc, routes, components, replayKey],
  );

  if (!doc) return <p style={{ padding: 32, font: "14px system-ui", opacity: 0.6 }}>Waiting for the editor…</p>;
  return (
    <>
      {page ?? <p style={{ padding: 32, font: "14px system-ui", opacity: 0.6 }}>This page has no sections yet. Add one from the editor.</p>}
      <Outline box={boxes.hover} color="#6b8cff" dashed />
      <Outline box={boxes.sel} color="#2f5bff" />
      {boxes.multi.map((b, i) => (
        <Outline key={i} box={b} color="#2f5bff" />
      ))}
      <Outline box={boxes.drop} color="#16a34a" label="Drop image" />
      {boxes.bar ? <FormatBar box={boxes.bar} run={(c) => editing.current?.command(c)} /> : null}
    </>
  );
}

function Outline({ box, color, dashed, label }: { box: Box; color: string; dashed?: boolean; label?: string }) {
  if (!box || box.width === 0) return null;
  const text = label ?? (!dashed ? box.label : "");
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
        background: label ? `${color}22` : undefined,
        pointerEvents: "none",
        zIndex: 2147483646,
      }}
    >
      {text ? (
        <span style={{ position: "absolute", top: box.top > 20 ? -20 : 0, left: -1, background: color, color: "#fff", font: "600 11px/18px system-ui", padding: "0 6px", borderRadius: "3px 3px 0 0", whiteSpace: "nowrap" }}>
          {text}
        </span>
      ) : null}
    </div>
  );
}

/** Floating format bar for rich text edits. mousedown is prevented so the selection survives. */
function FormatBar({ box, run }: { box: NonNullable<Box>; run: (c: "bold" | "italic" | "link" | "unlink") => void }) {
  const btn = (c: "bold" | "italic" | "link" | "unlink", label: React.ReactNode, title: string) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        run(c);
      }}
      style={{ border: 0, background: "transparent", color: "#fff", font: "600 13px system-ui", padding: "4px 8px", cursor: "pointer" }}
    >
      {label}
    </button>
  );
  return (
    <div
      data-format-bar=""
      style={{ position: "fixed", top: Math.max(4, box.top - 38), left: box.left, zIndex: 2147483647, display: "flex", background: "#111", borderRadius: 6, boxShadow: "0 4px 16px #0005" }}
    >
      {btn("bold", <b>B</b>, "Bold (⌘B)")}
      {btn("italic", <i>I</i>, "Italic (⌘I)")}
      {btn("link", "Link", "Link (⌘K)")}
      {btn("unlink", "Unlink", "Remove link")}
    </div>
  );
}
