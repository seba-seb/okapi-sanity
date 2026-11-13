import { createElement, isValidElement, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";

import { STUDIO_ACCENT, STUDIO_RADIUS_CONTROL, STUDIO_RADIUS_PANEL } from "@/theme/studio";

export type PickItem = {
  key: string;
  group: "Components" | "Blocks";
  title: string;
  description?: string;
  /** Schema icon (`defineType({ icon })`): a component or a node. */
  icon?: ComponentType | ReactNode;
  onPick: () => void;
};

export const renderIcon = (icon: PickItem["icon"]) =>
  icon == null ? "▢" : isValidElement(icon) || (typeof icon !== "object" && typeof icon !== "function") ? icon : createElement(icon as ComponentType);

/**
 * + Add, visual: library components and blocks as cards with their schema
 * icon and the `description` from blocks/meta.ts. Type to filter, Enter adds
 * the first match, Esc or a click outside closes.
 */
export function BlockPicker({ items, onClose }: { items: PickItem[]; onClose: () => void }) {
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => searchRef.current?.focus(), []);
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? items.filter((i) => `${i.title} ${i.description ?? ""}`.toLowerCase().includes(needle)) : items;
  }, [items, q]);
  const groups = (["Components", "Blocks"] as const).map((g) => [g, shown.filter((i) => i.group === g)] as const).filter(([, list]) => list.length);

  return (
    <div
      role="presentation"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => {
        e.stopPropagation(); // keep ⌫ / ⌘D etc. from reaching the editor's shortcuts
        if (e.key === "Escape") onClose();
      }}
      style={{ position: "fixed", inset: 0, zIndex: 100, display: "grid", placeItems: "center", background: "#0007" }}
    >
      <div
        role="dialog"
        aria-label="Add a block"
        style={{ width: "min(760px, 92vw)", maxHeight: "80vh", display: "flex", flexDirection: "column", borderRadius: STUDIO_RADIUS_PANEL, border, background: "var(--card-bg-color, #fff)", color: "var(--card-fg-color, inherit)", boxShadow: "0 20px 60px #0005" }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: 12, borderBottom: border }}>
          <strong style={{ fontSize: 14 }}>Add</strong>
          <input
            ref={searchRef}
            type="search"
            placeholder="Search blocks and components"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && shown[0]?.onPick()}
            style={{ flex: 1, padding: "6px 10px", font: "inherit", fontSize: 13, color: "inherit", background: "transparent", border, borderRadius: STUDIO_RADIUS_CONTROL }}
          />
          <button type="button" onClick={onClose} style={{ ...card, padding: "4px 10px", flexDirection: "row" }} aria-label="Close">
            Esc
          </button>
        </div>
        <div style={{ overflowY: "auto", padding: 12 }}>
          {groups.length ? (
            groups.map(([g, list]) => (
              <section key={g} style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4, opacity: 0.6, margin: "0 2px 8px" }}>{g}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 }}>
                  {list.map((i) => (
                    <button
                      key={i.key}
                      type="button"
                      onClick={i.onPick}
                      style={card}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = STUDIO_ACCENT)}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "")}
                      onFocus={(e) => (e.currentTarget.style.borderColor = STUDIO_ACCENT)}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "")}
                    >
                      <span aria-hidden style={tile}>
                        {renderIcon(i.icon)}
                      </span>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{i.title}</span>
                      {i.description ? <span style={{ fontSize: 11, opacity: 0.65, lineHeight: 1.35 }}>{i.description}</span> : null}
                    </button>
                  ))}
                </div>
              </section>
            ))
          ) : (
            <p style={{ opacity: 0.6, margin: 4 }}>Nothing matches “{q}”.</p>
          )}
        </div>
      </div>
    </div>
  );
}

const border = "1px solid color-mix(in srgb, currentColor 14%, transparent)";
const card = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 4,
  padding: 10,
  textAlign: "left",
  font: "inherit",
  color: "inherit",
  cursor: "pointer",
  background: "transparent",
  border,
  borderRadius: STUDIO_RADIUS_PANEL,
} as const;
const tile = {
  display: "grid",
  placeItems: "center",
  width: "100%",
  aspectRatio: "16 / 9",
  marginBottom: 4,
  fontSize: 32,
  borderRadius: STUDIO_RADIUS_CONTROL,
  color: STUDIO_ACCENT,
  background: `color-mix(in srgb, ${STUDIO_ACCENT} 10%, transparent)`,
} as const;
