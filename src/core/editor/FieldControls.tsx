import { createContext, useContext } from "react";
import type { ObjectSchemaType, SchemaType } from "sanity";

import { ptFromString } from "@/blocks/defaults";

/**
 * Properties panel controls generated from the compiled Studio schema — no
 * second definition of any field. Phase 0 covers what the current blocks use;
 * structure (arrays of blocks) is the layers' job, images stay in the form.
 */

type Field = { name: string; type: SchemaType };

/** Pages the editor knows about, for reference pickers (links to pages). */
export const PagesContext = createContext<{ id: string; title: string }[]>([]);
type Change = (path: string, value: unknown) => void;
export type View = "team" | "client";

const isPT = (t: SchemaType) =>
  t.jsonType === "array" && (t as { of?: SchemaType[] }).of?.some((m) => m.name === "block");
const isStringArray = (t: SchemaType) =>
  t.jsonType === "array" && (t as { of?: SchemaType[] }).of?.every((m) => m.jsonType === "string");
const isBlockArray = (t: SchemaType) => t.jsonType === "array" && !isPT(t) && !isStringArray(t);
const typeName = (t: SchemaType): string => (t.type ? `${t.name}<${t.type.name}>` : t.name);
const is = (t: SchemaType, name: string) => t.name === name || t.type?.name === name;
const listOf = (t: SchemaType) => {
  const list = (t.options as { list?: unknown[] } | undefined)?.list;
  return Array.isArray(list)
    ? list.map((o) => (o && typeof o === "object" ? (o as { title?: string; value: string }) : { title: String(o), value: String(o) }))
    : null;
};

export type ControlKind = "pt" | "lines" | "reference" | "choice" | "text" | "textarea" | "number" | "boolean" | "image" | "object" | "structure" | "unsupported";

/** Which control a schema type gets. Pure, so a check can assert coverage. */
export function controlKind(t: SchemaType): ControlKind {
  if (isPT(t)) return "pt";
  if (isStringArray(t)) return "lines";
  if (isBlockArray(t)) return "structure"; // children: the layers' job
  if (is(t, "reference")) return "reference";
  if (t.jsonType === "string") return listOf(t) ? "choice" : is(t, "text") ? "textarea" : "text";
  if (t.jsonType === "number") return "number";
  if (t.jsonType === "boolean") return "boolean";
  if (is(t, "image")) return "image";
  if (t.jsonType === "object" && (t as ObjectSchemaType).fields) return "object";
  return "unsupported";
}

/** Content = what a client may change. Everything else is design. */
export function isContent(t: SchemaType): boolean {
  if (isPT(t) || isStringArray(t) || is(t, "image") || is(t, "link") || is(t, "url") || is(t, "reference")) return true;
  if (t.jsonType === "string") return !listOf(t);
  return false;
}

function hiddenFor(t: SchemaType, parent: unknown, value: unknown): boolean {
  const h = (t as { hidden?: unknown }).hidden;
  if (typeof h === "function") {
    try {
      return !!h({ parent, value, document: undefined, currentUser: null });
    } catch {
      return false;
    }
  }
  return h === true;
}

/** Plain text of a simple Portable Text value, or null if it carries marks / several blocks. */
function ptToPlainIfSimple(v: unknown): string | null {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (!Array.isArray(v) || v.length > 1) return null;
  const b = v[0] as { children?: { text?: string; marks?: string[] }[] } | undefined;
  if (!b?.children) return "";
  if (b.children.some((c) => c.marks?.length)) return null;
  return b.children.map((c) => c.text ?? "").join("");
}

export function FieldList({
  type,
  value,
  basePath,
  onChange,
  view,
}: {
  type: ObjectSchemaType;
  value: Record<string, unknown>;
  basePath: string;
  onChange: Change;
  view: View;
}) {
  const fields = (type.fields as Field[]).filter(
    (f) => !isBlockArray(f.type) && !hiddenFor(f.type, value, value?.[f.name]) && (view === "team" || isContent(f.type)),
  );
  if (!fields.length) return <p style={muted}>Nothing to edit here{view === "client" ? " in client view" : ""}.</p>;
  return (
    <div style={{ display: "grid", gap: 14 }}>
      {fields.map((f) => (
        <FieldControl key={f.name} field={f} value={value?.[f.name]} parent={value} path={`${basePath}.${f.name}`} onChange={onChange} view={view} />
      ))}
    </div>
  );
}

function FieldControl({ field, value, parent, path, onChange, view }: { field: Field; value: unknown; parent: unknown; path: string; onChange: Change; view: View }) {
  const t = field.type;
  const title = t.title ?? field.name;
  const label = <div style={labelStyle}>{title}</div>;

  if (isPT(t)) {
    const plain = ptToPlainIfSimple(value);
    return (
      <label>
        {label}
        {plain === null ? (
          <p style={muted}>Formatted text — edit on the canvas (phase 1) or in the form.</p>
        ) : (
          <textarea rows={3} style={input} value={plain} onChange={(e) => onChange(path, ptFromString(e.target.value))} />
        )}
      </label>
    );
  }
  if (controlKind(t) === "reference") return <ReferencePicker label={label} value={value} path={path} onChange={onChange} />;
  if (isStringArray(t)) {
    const lines = Array.isArray(value) ? (value as string[]).join("\n") : "";
    return (
      <label>
        {label}
        <textarea rows={4} style={input} value={lines} onChange={(e) => onChange(path, e.target.value.split("\n"))} />
        <span style={hint}>One per line</span>
      </label>
    );
  }
  if (t.jsonType === "string") {
    const list = listOf(t);
    const current = (value as string | undefined) ?? (typeof t.initialValue === "string" ? t.initialValue : undefined);
    if (list)
      return (
        <div>
          {label}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {list.map((o) => (
              <button key={o.value} type="button" onClick={() => onChange(path, o.value)} style={{ ...chip, ...(current === o.value ? chipOn : null) }}>
                {o.title ?? o.value}
              </button>
            ))}
          </div>
        </div>
      );
    const multiline = is(t, "text");
    return (
      <label>
        {label}
        {multiline ? (
          <textarea rows={4} style={input} value={(value as string) ?? ""} onChange={(e) => onChange(path, e.target.value)} />
        ) : (
          <input style={input} value={(value as string) ?? ""} onChange={(e) => onChange(path, e.target.value)} />
        )}
      </label>
    );
  }
  if (t.jsonType === "number") {
    const o = (t.options ?? {}) as { min?: number; max?: number; step?: number; suffix?: string };
    const n = typeof value === "number" ? value : undefined;
    return (
      <label>
        {label}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {o.min !== undefined && o.max !== undefined ? (
            <input type="range" min={o.min} max={o.max} step={o.step ?? 1} value={n ?? o.min} onChange={(e) => onChange(path, Number(e.target.value))} style={{ flex: 1 }} />
          ) : null}
          <input type="number" style={{ ...input, width: 72 }} value={n ?? ""} onChange={(e) => onChange(path, e.target.value === "" ? undefined : Number(e.target.value))} />
          {o.suffix ? <span style={hint}>{o.suffix}</span> : null}
        </div>
      </label>
    );
  }
  if (t.jsonType === "boolean")
    return (
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(path, e.target.checked)} />
        <span style={labelStyle}>{title}</span>
      </label>
    );
  if (is(t, "image"))
    return (
      <div>
        {label}
        <p style={muted}>{(value as { asset?: unknown })?.asset ? "Image set" : "No image"} — change it in the form (drag & drop arrives in phase 1).</p>
      </div>
    );
  if (t.jsonType === "object" && (t as ObjectSchemaType).fields)
    return (
      <fieldset style={{ border: "1px solid color-mix(in srgb, currentColor 15%, transparent)", borderRadius: 8, padding: 10, margin: 0 }}>
        <legend style={labelStyle}>{title}</legend>
        <FieldList type={t as ObjectSchemaType} value={(value as Record<string, unknown>) ?? {}} basePath={path} onChange={onChange} view={view} />
      </fieldset>
    );
  return <p style={muted}>{title}: {typeName(t)} not editable here yet.</p>;
}

const muted = { opacity: 0.6, fontSize: 12, margin: 0 } as const;
const hint = { opacity: 0.55, fontSize: 11 } as const;
const labelStyle = { fontSize: 12, fontWeight: 600, marginBottom: 6, opacity: 0.85 } as const;
const input = {
  width: "100%",
  boxSizing: "border-box",
  padding: "6px 8px",
  font: "inherit",
  fontSize: 13,
  color: "inherit",
  background: "transparent",
  border: "1px solid color-mix(in srgb, currentColor 22%, transparent)",
  borderRadius: 6,
} as const;
const chip = { ...input, width: "auto", padding: "4px 9px", cursor: "pointer", fontSize: 12 } as const;
const chipOn = { background: "#2f5bff", borderColor: "#2f5bff", color: "#fff" } as const;

function ReferencePicker({ label, value, path, onChange }: { label: React.ReactNode; value: unknown; path: string; onChange: Change }) {
  const pages = useContext(PagesContext);
  const ref = (value as { _ref?: string } | undefined)?._ref ?? "";
  return (
    <label>
      {label}
      <select
        style={input}
        value={ref}
        onChange={(e) => onChange(path, e.target.value ? { _type: "reference", _ref: e.target.value } : undefined)}
      >
        <option value="">— None —</option>
        {pages.map((p) => (
          <option key={p.id} value={p.id}>
            {p.title}
          </option>
        ))}
      </select>
    </label>
  );
}
