import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useClient, useCurrentUser, useDocumentOperation, useEditState, useSchema, type ObjectSchemaType } from "sanity";

import { apiVersion } from "@/core/sanity/env";
import { pageHref, toRoutes, type Routes } from "@/core/lib/routes";
import { resolveSelection } from "@/core/canvas/editorOps";
import type { Page } from "@/core/lib/types";

import { CANVAS_PATH, listen, post, type ToEditor } from "./protocol";
import { FieldList, PagesContext, type View } from "./FieldControls";

type Row = { _id: string; title?: string; slug?: string };
const DEVICES = { Desktop: "100%", Tablet: "768px", Mobile: "390px" } as const;

/**
 * Remarkable Editor (Studio tool, /studio#/editor) — phase 0.
 * Pages | canvas (iframe of /edit-canvas rendering the real PageBuilder) |
 * properties generated from the schema. Edits go through the Studio's own
 * document store (useDocumentOperation → patch), which applies them locally
 * at once and saves the draft in the background; useEditState hands the
 * canvas the locally-edited document, so the canvas never waits on the network.
 */
export function EditorTool() {
  const client = useClient({ apiVersion });
  const [pages, setPages] = useState<Row[]>([]);
  const [routes, setRoutes] = useState<Routes>({});
  const [pageId, setPageId] = useState<string | null>(null);

  useEffect(() => {
    client
      .withConfig({ perspective: "drafts" })
      .fetch<Row[]>(`*[_type == "page" && defined(slug.current)] | order(title asc){ _id, title, "slug": slug.current }`)
      .then((rows) => {
        const clean = rows.map((r) => ({ ...r, _id: r._id.replace(/^drafts\./, "") }));
        setPages(clean.sort((a, b) => (a.slug === "home" ? -1 : b.slug === "home" ? 1 : 0)));
        setRoutes(toRoutes(clean.map((r) => ({ _id: r._id, slug: r.slug! }))));
        setPageId((cur) => cur ?? clean[0]?._id ?? null);
      });
  }, [client]);

  const pageOptions = useMemo(() => pages.map((p) => ({ id: p._id, title: p.title || p.slug || p._id })), [pages]);
  return (
    <PagesContext.Provider value={pageOptions}>
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 320px", height: "100%", minHeight: 0, fontSize: 13 }}>
      <aside style={{ ...column, borderRight: border }}>
        <div style={heading}>Pages</div>
        {pages.map((p) => (
          <button key={p._id} type="button" onClick={() => setPageId(p._id)} style={{ ...rowBtn, ...(p._id === pageId ? rowOn : null) }}>
            {p.title || p.slug}
            <span style={{ display: "block", opacity: 0.55, fontSize: 11 }}>{pageHref(p.slug)}</span>
          </button>
        ))}
      </aside>
      {pageId ? <PageEditor key={pageId} id={pageId} routes={routes} /> : <div style={{ padding: 24, opacity: 0.6 }}>Loading pages…</div>}
    </div>
    </PagesContext.Provider>
  );
}

function PageEditor({ id, routes }: { id: string; routes: Routes }) {
  const { draft, published, ready } = useEditState(id, "page");
  const doc = (draft ?? published) as Page | null;
  const ops = useDocumentOperation(id, "page");
  const schema = useSchema();
  const user = useCurrentUser();
  const isTeam = !!user?.roles?.some((r) => r.name === "administrator");
  const [view, setView] = useState<View>(isTeam ? "team" : "client");
  const [device, setDevice] = useState<keyof typeof DEVICES>("Desktop");
  const [selected, setSelected] = useState<string | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [canvasReady, setCanvasReady] = useState(false);

  // Canvas → editor
  useEffect(
    () =>
      listen<ToEditor>((msg, source) => {
        if (source !== frame.current?.contentWindow) return;
        if (msg.type === "ready") setCanvasReady(true);
        if (msg.type === "select") setSelected(msg.path);
      }),
    [],
  );

  // Editor → canvas: every local edit re-renders the canvas immediately.
  useEffect(() => {
    if (canvasReady && doc) post(frame.current?.contentWindow, { type: "render", doc, routes });
  }, [canvasReady, doc, routes]);

  const target = useMemo(() => (doc && selected ? resolveSelection(doc, selected) : null), [doc, selected]);
  const type = target ? (schema.get(target.item._type) as ObjectSchemaType | undefined) : undefined;

  const onChange = useCallback(
    (path: string, value: unknown) => {
      ops.patch.execute([value === undefined ? { unset: [path] } : { set: { [path]: value } }]);
    },
    [ops.patch],
  );

  const select = (path: string | null) => {
    setSelected(path);
    post(frame.current?.contentWindow, { type: "select", path });
  };

  const publishDisabled = ops.publish.disabled;
  return (
    <>
      <main style={{ display: "flex", flexDirection: "column", minHeight: 0, background: "color-mix(in srgb, currentColor 6%, transparent)" }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "8px 12px", borderBottom: border }}>
          {(Object.keys(DEVICES) as (keyof typeof DEVICES)[]).map((d) => (
            <button key={d} type="button" onClick={() => setDevice(d)} style={{ ...chip, ...(device === d ? chipOn : null) }}>
              {d}
            </button>
          ))}
          <span style={{ flex: 1 }} />
          <span style={{ opacity: 0.6, fontSize: 12 }}>{!ready ? "Loading…" : draft ? "Unpublished changes" : "Published"}</span>
          <button
            type="button"
            disabled={!!publishDisabled}
            title={typeof publishDisabled === "string" ? publishDisabled : undefined}
            onClick={() => ops.publish.execute()}
            style={{ ...chip, ...chipOn, opacity: publishDisabled ? 0.45 : 1 }}
          >
            Publish
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, display: "flex", justifyContent: "center", overflow: "auto" }}>
          <iframe
            ref={frame}
            src={CANVAS_PATH}
            title="Canvas"
            style={{ width: DEVICES[device], height: "100%", border: 0, background: "#fff", transition: "width 200ms ease" }}
          />
        </div>
      </main>
      <aside style={{ ...column, borderLeft: border }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
          <div style={{ ...heading, margin: 0, flex: 1 }}>{target ? (type?.title ?? target.item._type) : "Properties"}</div>
          {isTeam ? (
            <button type="button" onClick={() => setView(view === "team" ? "client" : "team")} style={chip} title="Preview what a client sees">
              {view === "team" ? "Team view" : "Client view"}
            </button>
          ) : null}
        </div>
        {target ? (
          <>
            <button type="button" onClick={() => select(parentPath(selected!))} style={{ ...chip, marginBottom: 12 }} disabled={!parentPath(selected!)}>
              ↑ Select parent
            </button>
            {type ? (
              <FieldList type={type} value={target.item as Record<string, unknown>} basePath={selected!} onChange={onChange} view={view} />
            ) : (
              <p style={{ opacity: 0.6 }}>Unknown block type “{target.item._type}”.</p>
            )}
          </>
        ) : (
          <p style={{ opacity: 0.6, margin: 0 }}>Click anything on the canvas to edit it.</p>
        )}
      </aside>
    </>
  );
}

/** `a[_key=="x"].b[_key=="y"]` → `a[_key=="x"]` (the enclosing block), or null. */
function parentPath(path: string): string | null {
  const i = path.lastIndexOf("[_key==");
  const j = path.lastIndexOf("[_key==", i - 1);
  return j < 0 ? null : path.slice(0, path.indexOf("]", j) + 1);
}

const border = "1px solid color-mix(in srgb, currentColor 14%, transparent)";
const column = { padding: 12, overflowY: "auto", minHeight: 0 } as const;
const heading = { fontWeight: 600, margin: "4px 4px 10px" } as const;
const rowBtn = { display: "block", width: "100%", textAlign: "left", padding: "7px 8px", border: 0, borderRadius: 6, font: "inherit", color: "inherit", cursor: "pointer", background: "transparent" } as const;
const rowOn = { background: "color-mix(in srgb, currentColor 14%, transparent)", fontWeight: 600 } as const;
const chip = { padding: "4px 10px", font: "inherit", fontSize: 12, color: "inherit", cursor: "pointer", background: "transparent", border, borderRadius: 6 } as const;
const chipOn = { background: "#2f5bff", borderColor: "#2f5bff", color: "#fff" } as const;
