"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { useDocuments } from "@sanity/visual-editing/react";
import { at, insert as mInsert, set as mSet } from "@sanity/mutate";

import { EDITOR_CHANNEL, type EditorMessage } from "@/lib/editorBridge";
import {
  resolveSelection,
  reKey,
  randomKey,
  topSectionKey,
  slotFor,
  slotAccepts,
} from "@/lib/editorOps";
import { selectElementByKey } from "@/lib/canvasSelect";
import { INSERT_DEFAULTS } from "@/lib/blockDefaults";
import type { Block } from "@/lib/types";

/**
 * A Webflow-style quick-insert palette for the Presentation canvas.
 *
 *   ⌘/Ctrl + E  or  ⌘/Ctrl + F  → open
 *   type to filter · ↑/↓ to move · Enter to insert · Esc to close
 *
 * Where the new element lands depends on the current selection:
 *   • a container (section / grid / slider / content wrapper) → INTO its slot
 *   • a leaf element (heading, paragraph, …) → as a SIBLING right after it
 *   • a section is always inserted at the top level
 *   • nothing selected → appended to the last section
 *
 * Insertion rides the same optimistic document store as the drag-reorder
 * (`useDocuments().patch`), so it appears instantly. Renders nothing when closed.
 */

type Insertable = { type: string; title: string };

const INSERTABLE: Insertable[] = [
  { type: "section", title: "Section" },
  { type: "heading", title: "Heading" },
  { type: "paragraph", title: "Paragraph" },
  { type: "eyebrow", title: "Eyebrow" },
  { type: "button", title: "Button" },
  { type: "buttonWrapper", title: "Button Group" },
  { type: "imageBlock", title: "Image" },
  { type: "loopingVideo", title: "Looping Video" },
  { type: "contentWrapper", title: "Content Wrapper" },
  { type: "card", title: "Card" },
  { type: "grid", title: "Grid" },
  { type: "slider", title: "Slider" },
  { type: "logo3d", title: "3D Logo" },
];

type Selection = { id: string; path: string };

export function InsertPalette() {
  const { getDocument } = useDocuments();
  const getDocumentRef = useRef(getDocument);
  getDocumentRef.current = getDocument;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const openRef = useRef(open);
  openRef.current = open;
  const selectionRef = useRef<Selection | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return INSERTABLE;
    return INSERTABLE.filter(
      (it) =>
        it.title.toLowerCase().includes(q) || it.type.toLowerCase().includes(q),
    );
  }, [query]);

  // Keep the highlight in range as the list filters down.
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, results.length - 1)));
  }, [results.length]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActiveIndex(0);
  }, []);

  const openPalette = useCallback(() => {
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const doInsert = useCallback(
    async (type: string) => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        const sel = selectionRef.current;
        const id =
          sel?.id ??
          document
            .querySelector("[data-sanity-id]")
            ?.getAttribute("data-sanity-id") ??
          null;
        if (!id) return;

        const doc = getDocumentRef.current(id);
        const snapshot = (await doc.getSnapshot()) as Record<
          string,
          unknown
        > | null;
        if (!snapshot) return;

        const defaults = INSERT_DEFAULTS[type]?.() ?? {};
        const block = {
          ...(reKey(defaults) as Record<string, unknown>),
          _type: type,
          _key: randomKey(),
        } as Block;

        const sections = (snapshot.sections as Block[] | undefined) ?? [];
        const resolved = sel ? resolveSelection(snapshot, sel.path) : null;
        const item = resolved?.item;

        // Append a block into an existing slot array (or seed the array).
        const appendInto = (slotPath: string, children: Block[]) =>
          children.length
            ? at(slotPath, mInsert([block], "after", {
                _key: children[children.length - 1]._key,
              }))
            : at(slotPath, mSet([block]));

        // `at(...)` yields differently-typed NodePatch generics per branch;
        // keep it loose and cast at the call.
        let patch: object | null = null;

        if (type === "section") {
          // Sections only live at the top level.
          const secKey =
            item?._type === "section"
              ? item._key
              : sel
                ? topSectionKey(sel.path)
                : null;
          if (secKey) {
            patch = at("sections", mInsert([block], "after", { _key: secKey }));
          } else if (sections.length) {
            patch = at("sections", mInsert([block], "after", {
              _key: sections[sections.length - 1]._key,
            }));
          } else {
            patch = at("sections", mSet([block]));
          }
        } else if (item && resolved) {
          const slot = slotFor(item._type);
          if (slot && slotAccepts(slot, type)) {
            // Selected element is a container that accepts this type → nest it.
            const children =
              ((item as Record<string, unknown>)[slot.field] as
                | Block[]
                | undefined) ?? [];
            // 2nd+ button added to a group defaults to outline (matches the
            // Studio's ButtonsArrayInput).
            if (type === "button" && slot.field === "buttons" && children.length) {
              (block as Record<string, unknown>).style = "outline";
            }
            patch = appendInto(`${resolved.itemPath}.${slot.field}`, children);
          } else {
            // Leaf element (or an incompatible container) → drop in after it. A
            // button dropped beside buttons already in a group → outline too.
            if (
              type === "button" &&
              resolved.parentArrayPath.endsWith(".buttons") &&
              resolved.parentArray.length
            ) {
              (block as Record<string, unknown>).style = "outline";
            }
            patch = at(resolved.parentArrayPath, mInsert([block], "after", {
              _key: item._key,
            }));
          }
        } else {
          // Nothing selected → append to the last section.
          const lastSection = sections[sections.length - 1];
          if (lastSection) {
            const children =
              (lastSection.content as Block[] | undefined) ?? [];
            patch = appendInto(
              `sections[_key=="${lastSection._key}"].content`,
              children,
            );
          }
        }

        close();
        if (patch) {
          doc.patch([patch] as never);
          // Select the freshly-inserted element once it renders on the canvas.
          selectElementByKey(block._key);
        }
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.warn("InsertPalette: insert failed", err);
        }
      } finally {
        busyRef.current = false;
      }
    },
    [close],
  );

  // Track the selected element, the open shortcut, and Studio-forwarded opens.
  useEffect(() => {
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel(EDITOR_CHANNEL)
        : null;

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
      const mod = e.metaKey || e.ctrlKey;
      const isToggle =
        mod &&
        !e.altKey &&
        !e.shiftKey &&
        (e.key === "e" || e.key === "E" || e.key === "f" || e.key === "F");
      if (isToggle) {
        // Don't steal ⌘F from a genuine text field (unless it's our own input).
        const t = e.target as HTMLElement | null;
        const inField =
          !!t &&
          (t.tagName === "INPUT" ||
            t.tagName === "TEXTAREA" ||
            t.isContentEditable);
        if (!openRef.current && inField && t !== inputRef.current) return;
        e.preventDefault();
        if (openRef.current) close();
        else openPalette();
        return;
      }
      if (e.key === "Escape" && openRef.current) {
        e.preventDefault();
        close();
      }
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKeyDown, true);
    if (channel) {
      channel.onmessage = (e: MessageEvent<EditorMessage>) => {
        if (e.data?.type === "open-palette") openPalette();
      };
    }

    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKeyDown, true);
      channel?.close();
    };
  }, [close, openPalette]);

  const onInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) =>
        results.length ? (i - 1 + results.length) % results.length : 0,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[activeIndex];
      if (r) void doInsert(r.type);
    }
  };

  if (!open) return null;

  return (
    <div style={backdrop} onMouseDown={close}>
      <div style={box} onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={onInputKeyDown}
          placeholder="Search elements…"
          style={input}
          autoFocus
          spellCheck={false}
        />
        <div style={list}>
          {results.map((it, i) => (
            <div
              key={it.type}
              role="option"
              aria-selected={i === activeIndex}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                void doInsert(it.type);
              }}
              style={{ ...row, ...(i === activeIndex ? rowActive : null) }}
            >
              <span style={dot} />
              {it.title}
            </div>
          ))}
          {results.length === 0 && <div style={emptyRow}>No elements</div>}
        </div>
        <div style={hint}>↑↓ to navigate · ↵ to insert · esc to close</div>
      </div>
    </div>
  );
}

const backdrop: CSSProperties = {
  position: "fixed",
  inset: 0,
  // Above the canvas resize handle (also fixed at 2147483000) so its blue
  // outline/handle doesn't paint over the palette; the dim recedes it too.
  zIndex: 2147483647,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  justifyContent: "center",
  alignItems: "flex-start",
  paddingTop: "12vh",
};

const box: CSSProperties = {
  width: "min(560px, 92vw)",
  background: "#1b1b1d",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
  overflow: "hidden",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
};

const input: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "transparent",
  border: "none",
  outline: "none",
  color: "#fff",
  fontSize: 16,
  padding: "16px 18px",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
};

const list: CSSProperties = {
  maxHeight: 320,
  overflowY: "auto",
  padding: 6,
};

const row: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "9px 12px",
  borderRadius: 8,
  color: "rgba(255,255,255,0.85)",
  fontSize: 14,
  cursor: "pointer",
  userSelect: "none",
};

const rowActive: CSSProperties = {
  background: "rgba(255,255,255,0.09)",
  color: "#fff",
};

const dot: CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: "50%",
  background: "#9fe870",
  flex: "0 0 auto",
};

const emptyRow: CSSProperties = {
  padding: "12px",
  color: "rgba(255,255,255,0.4)",
  fontSize: 14,
};

const hint: CSSProperties = {
  padding: "8px 14px",
  borderTop: "1px solid rgba(255,255,255,0.08)",
  color: "rgba(255,255,255,0.4)",
  fontSize: 12,
};
