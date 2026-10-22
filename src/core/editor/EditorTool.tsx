import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useClient, useCurrentUser, useDocumentOperation, useDocumentOperationEvent, useEditState, useSchema, useValidationStatus, type ObjectSchemaType } from "sanity";

import { apiVersion } from "@/core/sanity/env";
import { pageHref, toRoutes, type Routes } from "@/core/lib/routes";
import { reKey, resolveSelection } from "@/core/editor/paths";
import { blockMeta, blockTypes } from "@/blocks/meta";
import type { Block, Page } from "@/core/lib/types";
import type { Components } from "@/core/render/components";
import { applyOverrides, splitInstancePath, type Override } from "@/core/render/overrides";
import { randomKey } from "./paths";

import { CANVAS_PATH, listen, post, type ToEditor } from "./protocol";
import { buildCatalog, FieldList, PagesContext, UploadContext } from "./FieldControls";
import { EditorChat } from "./EditorChat";
import { applyOps, type AttachedImages } from "./chat";
import { grantFor, may, mayAdd, mayReorder } from "./policy";
import { POLICY } from "@/okapi.policy";
import { FEATURES } from "@/core/config";
import { canPlace, duplicateMany, moveNextTo, insert, insertMany, insertTarget, layers, move, newBlock, nudgeMany, parentBlock, remove, removeMany, splitAllowed, topmost, type Doc, type LayerNode } from "./ops";
import { plainToPt } from "./text";
import { STUDIO_ACCENT, STUDIO_RADIUS_CONTROL, STUDIO_RADIUS_PANEL } from "@/theme/studio";

type Row = { _id: string; title?: string; slug?: string };
const DEVICES = { Desktop: "100%", Tablet: "768px", Mobile: "390px" } as const;
const CLIPBOARD = "okapi:editor-clipboard";
const COALESCE_MS = 1200;

/**
 * Okapi Editor (Studio tool, /studio#/editor).
 * Pages + layers | canvas (iframe of /edit-canvas, the real PageBuilder) |
 * properties (generated from the schema). Reads with useEditState (local edits
 * applied at once), writes through the Studio document store
 * (useDocumentOperation → patch/publish), so the canvas never waits on the
 * network and drafts save in the background.
 */
export function EditorTool() {
  const client = useClient({ apiVersion });
  const [pages, setPages] = useState<Row[]>([]);
  const [routes, setRoutes] = useState<Routes>({});
  const [pageId, setPageId] = useState<string | null>(null);
  const [components, setComponents] = useState<Components>({});

  // Pages + library components (drafts perspective: the editor sees unpublished
  // work). Reloaded on every document switch so instances show the latest
  // component edits.
  const loadAll = useCallback(async () => {
    const drafts = client.withConfig({ perspective: "drafts" });
    const [rows, comps] = await Promise.all([
      drafts.fetch<Row[]>(`*[_type == "page" && defined(slug.current)] | order(title asc){ _id, title, "slug": slug.current }`),
      drafts.fetch<{ _id: string; title?: string; sections?: [] }[]>(`*[_type == "component"] | order(title asc){ _id, title, sections }`),
    ]);
    const clean = rows.map((r) => ({ ...r, _id: r._id.replace(/^drafts\./, "") }));
    setPages(clean.sort((a, b) => (a.slug === "home" ? -1 : b.slug === "home" ? 1 : 0)));
    setRoutes(toRoutes(clean.map((r) => ({ _id: r._id, slug: r.slug! }))));
    setComponents(Object.fromEntries(comps.map((c) => [c._id.replace(/^drafts\./, ""), c])));
    setPageId((cur) => cur ?? clean[0]?._id ?? null);
  }, [client]);
  useEffect(() => {
    loadAll();
  }, [loadAll, pageId]);

  const upload = useCallback(async (file: File) => {
    const asset = await client.assets.upload("image", file, { filename: file.name });
    return { _type: "image", asset: { _type: "reference", _ref: asset._id } };
  }, [client]);

  const refOptions = useMemo(
    () => ({
      page: pages.map((p) => ({ id: p._id, title: p.title || p.slug || p._id })),
      component: Object.entries(components).map(([id, c]) => ({ id, title: c.title || id })),
    }),
    [pages, components],
  );
  const docType = pageId && components[pageId] ? "component" : "page";
  const [cols, setCols] = useState(readCols);
  useEffect(() => {
    try {
      localStorage.setItem(COLS_KEY, JSON.stringify(cols));
    } catch {
      /* private mode: widths reset on reload */
    }
  }, [cols]);
  return (
    <PagesContext.Provider value={refOptions}>
      <UploadContext.Provider value={upload}>
        <div style={{ position: "relative", display: "grid", gridTemplateColumns: `${cols.left}px 1fr ${cols.right}px`, height: "100%", minHeight: 0, fontSize: 13 }}>
          {pageId ? (
            <PageEditor
              key={pageId}
              id={pageId}
              docType={docType}
              routes={routes}
              pages={pages}
              components={components}
              onPage={setPageId}
              onLibraryChange={loadAll}
              upload={upload}
            />
          ) : (
            <div style={{ padding: 24, opacity: 0.6 }}>Loading pages…</div>
          )}
          <Resizer side="left" width={cols.left} onChange={(left) => setCols((c) => ({ ...c, left }))} />
          <Resizer side="right" width={cols.right} onChange={(right) => setCols((c) => ({ ...c, right }))} />
        </div>
      </UploadContext.Provider>
    </PagesContext.Provider>
  );
}

function PageEditor({
  id,
  docType,
  routes,
  pages,
  components,
  onPage,
  onLibraryChange,
  upload,
}: {
  id: string;
  docType: "page" | "component";
  routes: Routes;
  pages: Row[];
  components: Components;
  onPage: (id: string) => void;
  onLibraryChange: () => Promise<void>;
  upload: (file: File) => Promise<unknown>;
}) {
  const client = useClient({ apiVersion });
  const { draft, published, ready } = useEditState(id, docType);
  const doc = (draft ?? published) as (Page & Doc) | null;
  const docRef = useRef(doc);
  docRef.current = doc;
  const ops = useDocumentOperation(id, docType);
  const opEvent = useDocumentOperationEvent(id, docType);
  const { validation } = useValidationStatus(id, docType, false);
  const schema = useSchema();
  const user = useCurrentUser();
  // What this person may do (src/okapi.policy.ts). Admins can preview any role.
  const roles = useMemo(() => user?.roles?.map((r) => r.name) ?? [], [user]);
  const isAdmin = roles.includes("administrator");
  const [viewAs, setViewAs] = useState<string | null>(null);
  const grant = useMemo(() => grantFor(viewAs ? [viewAs] : roles, POLICY), [roles, viewAs]);
  const canStructure = may(grant, "structure");
  const canReorder = mayReorder(grant);
  const canChat = FEATURES.chat && may(grant, "chat");
  const catalog = useMemo(() => buildCatalog(schema, blockTypes), [schema]);
  const [tab, setTab] = useState<"properties" | "chat">("properties");
  // Once opened, the chat stays mounted (hidden) so switching tabs keeps the conversation.
  const chatOpened = useRef(false);
  if (tab === "chat") chatOpened.current = true;
  const [device, setDevice] = useState<keyof typeof DEVICES>("Desktop");
  // Selection: several blocks; the last one is the primary (panel, + Add anchor).
  const [selection, setSelection] = useState<string[]>([]);
  const selected = selection.at(-1) ?? null;
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const [status, setStatus] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  // Bumped on every `ready`: the canvas reloads (deploy, stale chunk) and must get the page again.
  const [canvasReady, setCanvasReady] = useState(0);

  // ── History: snapshots of `sections` (everything the editor changes lives there).
  const past = useRef<Block[][]>([]);
  const future = useRef<Block[][]>([]);
  const lastCoalesce = useRef<{ key: string; at: number } | null>(null);
  const [, bump] = useState(0);
  const record = useCallback((coalesce?: string) => {
    const now = Date.now();
    const last = lastCoalesce.current;
    if (coalesce && last && last.key === coalesce && now - last.at < COALESCE_MS) {
      last.at = now; // same burst of typing: one undo step
      return;
    }
    lastCoalesce.current = coalesce ? { key: coalesce, at: now } : null;
    past.current.push(structuredClone(docRef.current?.sections ?? []));
    if (past.current.length > 100) past.current.shift();
    future.current = [];
    bump((n) => n + 1);
  }, []);

  const setField = useCallback(
    (path: string, value: unknown, coalesce = path) => {
      record(coalesce);
      ops.patch.execute([value === undefined ? { unset: [path] } : { set: { [path]: value } }]);
    },
    [ops.patch, record],
  );
  /**
   * Write `value` to `path.field` — or, if the path is inside a component
   * instance, upsert a per-instance override instead (the master stays put).
   */
  const writeField = useCallback(
    (path: string, field: string, value: unknown, kind: "text" | "rich" | "image", coalesce?: string) => {
      const inst = splitInstancePath(path);
      if (!inst) return setField(`${path}.${field}`, value, coalesce);
      const target = `${inst.blockKey}.${field}`;
      const current = (docRef.current && (resolveSelection(docRef.current, inst.instancePath)?.item.overrides as Override[] | undefined)) ?? [];
      const prev = current.find((o) => o.target === target);
      const next = [...current.filter((o) => o.target !== target), { _key: prev?._key ?? randomKey(), _type: "componentOverride", target, [kind]: value }];
      setField(`${inst.instancePath}.overrides`, next, coalesce ?? `override:${inst.instancePath}:${target}`);
    },
    [setField],
  );
  const setSections = useCallback(
    (next: Doc) => {
      record();
      ops.patch.execute([{ set: { sections: next.sections ?? [] } }]);
    },
    [ops.patch, record],
  );
  const travel = useCallback(
    (from: React.MutableRefObject<Block[][]>, to: React.MutableRefObject<Block[][]>) => {
      const snap = from.current.pop();
      if (!snap) return;
      to.current.push(structuredClone(docRef.current?.sections ?? []));
      lastCoalesce.current = null;
      ops.patch.execute([{ set: { sections: snap } }]);
      bump((n) => n + 1);
    },
    [ops.patch],
  );
  // Every edit rewrites the whole `sections` array, so with two people on one
  // page the last write wins (AGENTS.md → Known limitations). Warn when someone
  // else writes, and drop undo steps: they'd restore sections without that change.
  const [conflict, setConflict] = useState(false);
  useEffect(() => {
    if (!user?.id) return;
    const sub = client
      .listen("*[_id in $ids]", { ids: [id, `drafts.${id}`] }, { includeResult: false, events: ["mutation"] })
      .subscribe((e) => {
        if (e.type !== "mutation" || e.identity === user.id) return;
        past.current = [];
        future.current = [];
        bump((n) => n + 1);
        setConflict(true);
      });
    return () => sub.unsubscribe();
  }, [client, id, user?.id]);
  const undo = useCallback(() => travel(past, future), [travel]);
  const redo = useCallback(() => travel(future, past), [travel]);

  const selectPaths = useCallback((paths: string[], scroll = false) => {
    setSelection(paths);
    post(frame.current?.contentWindow, { type: "select", path: paths.at(-1) ?? null, paths, scroll });
  }, []);
  const select = useCallback((path: string | null, scroll = false) => selectPaths(path ? [path] : [], scroll), [selectPaths]);
  /** Shift/⌘-click: add or remove one block from the selection. */
  const toggle = useCallback(
    (path: string) => {
      const cur = selectionRef.current;
      selectPaths(cur.includes(path) ? cur.filter((p) => p !== path) : [...cur, path]);
    },
    [selectPaths],
  );

  // ── Actions on the selection
  const act = useCallback(
    (fn: (d: Doc) => { doc: Doc; path?: string | null; paths?: string[] } | Doc) => {
      const d = docRef.current;
      if (!d) return;
      try {
        const res = fn(d) as { doc?: Doc; path?: string | null; paths?: string[] };
        const out = res.doc ? res : { doc: res as Doc, path: null };
        setSections(out.doc!);
        if (out.paths) selectPaths(out.paths, true);
        else if (out.path !== undefined) select(out.path, true);
      } catch (e) {
        setStatus((e as Error).message);
      }
    },
    [select, selectPaths, setSections],
  );
  const doRemove = useCallback(
    () => selection.length && canStructure && act((d) => ({ doc: removeMany(d, selection), path: parentBlock(selected!) })),
    [act, canStructure, selected, selection],
  );
  const doDuplicate = useCallback(() => selection.length && canStructure && act((d) => duplicateMany(d, selection)), [act, canStructure, selection]);
  const doNudge = useCallback((dir: -1 | 1) => selection.length && canReorder && act((d) => nudgeMany(d, selection, dir)), [act, canReorder, selection]);
  const doCopy = useCallback(() => {
    const items = docRef.current ? topmost(selection).map((p) => resolveSelection(docRef.current!, p)?.item).filter(Boolean) : [];
    if (items.length) {
      localStorage.setItem(CLIPBOARD, JSON.stringify(items));
      setStatus(items.length === 1 ? `Copied ${blockMeta(items[0]!._type)?.title ?? items[0]!._type}` : `Copied ${items.length} blocks`);
    }
  }, [selection]);
  const doPaste = useCallback(() => {
    if (!canStructure) return;
    const raw = localStorage.getItem(CLIPBOARD);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Block | Block[];
    // The role's block list applies to pasted blocks too, nested ones included.
    const { ok, denied } = splitAllowed(Array.isArray(parsed) ? parsed : [parsed], (t) => mayAdd(grant, t));
    const why = `Your role can't add ${denied.map((t) => blockMeta(t)?.title ?? t).join(", ")}`;
    if (!ok.length) return setStatus(why);
    act((d) => {
      const r = insertMany(d, selected, ok.map((b) => reKey(b)));
      if (!r.paths.length) throw new Error("Nothing can be pasted here");
      return r;
    });
    if (denied.length) setStatus(`${why} — pasted the rest`);
  }, [act, canStructure, grant, selected]);
  const doAdd = useCallback(
    (type: string) => {
      setAdding(false);
      if (!mayAdd(grant, type)) return;
      act((d) => {
        const t = insertTarget(d, selected, type);
        if (!t) throw new Error(`Can't add a ${type} here`);
        return insert(d, t.arrayPath, t.index, newBlock(type));
      });
    },
    [act, grant, selected],
  );

  // ── Components
  const addInstance = useCallback(
    (componentId: string) => {
      setAdding(false);
      act((d) => {
        const t = insertTarget(d, selected, "componentRef");
        if (!t) throw new Error("Components go between sections");
        return insert(d, t.arrayPath, t.index, { ...newBlock("componentRef"), component: { _type: "reference", _ref: componentId } });
      });
    },
    [act, selected],
  );
  const makeComponent = useCallback(async () => {
    const r = selected && docRef.current ? resolveSelection(docRef.current, selected) : null;
    if (!r || r.item._type !== "section") return;
    const title = window.prompt("Component name", (r.item.name as string) || "New component");
    if (!title) return;
    try {
      // Published right away: instances render from published components on the site.
      const created = await client.create({ _type: "component", title, sections: [reKey(r.item)] });
      await onLibraryChange();
      act((d) => {
        const at = resolveSelection(d, selected!); // the page may have changed while saving
        if (!at) throw new Error("The section moved while saving — insert the component from + Add");
        const out = remove(d, selected!);
        return insert(out, at.parentArrayPath, at.index, { ...newBlock("componentRef"), component: { _type: "reference", _ref: created._id } });
      });
      setStatus(`Saved “${title}” to the library`);
    } catch (e) {
      setStatus(`Couldn't make the component: ${(e as Error).message}`);
    }
  }, [act, client, onLibraryChange, selected]);
  const detach = useCallback(() => {
    const r = selected && docRef.current ? resolveSelection(docRef.current, selected) : null;
    const ref = (r?.item.component as { _ref?: string } | undefined)?._ref;
    const comp = ref ? components[ref] : undefined;
    if (!r || !comp?.sections?.length) return;
    // The copy carries what this instance overrode (texts, images), not the master's.
    const sections = applyOverrides(comp.sections, r.item.overrides as Override[] | undefined);
    act((d) => {
      let out = remove(d, selected!);
      sections.forEach((s, i) => {
        out = insert(out, r.parentArrayPath, r.index + i, reKey(s as Block)).doc;
      });
      return { doc: out, path: null };
    });
  }, [act, components, selected]);

  const onKey = useCallback(
    (k: { key: string; mod: boolean; shift: boolean; alt: boolean }) => {
      if (k.mod && k.key.toLowerCase() === "z") return k.shift ? redo() : undo();
      if (k.mod && k.key.toLowerCase() === "y") return redo();
      if (k.mod && k.key.toLowerCase() === "d") return doDuplicate();
      if (k.mod && k.key.toLowerCase() === "c") return doCopy();
      if (k.mod && k.key.toLowerCase() === "v") return doPaste();
      if (k.key === "Delete" || k.key === "Backspace") return doRemove();
      if (k.alt && k.key === "ArrowUp") return doNudge(-1);
      if (k.alt && k.key === "ArrowDown") return doNudge(1);
      if (k.key === "Escape" && selected) return select(parentBlock(selected));
    },
    [doCopy, doDuplicate, doNudge, doPaste, doRemove, redo, select, selected, undo],
  );
  // Shortcuts pressed in the editor chrome (not while typing in a field).
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      const mod = e.metaKey || e.ctrlKey;
      const handled = e.key === "Delete" || e.key === "Backspace" || e.key === "Escape" || (e.altKey && /^Arrow(Up|Down)$/.test(e.key)) || (mod && /^[dzcvy]$/i.test(e.key));
      if (!handled) return;
      e.preventDefault();
      onKey({ key: e.key, mod, shift: e.shiftKey, alt: e.altKey });
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onKey]);

  // ── Canvas → editor
  const onKeyRef = useRef(onKey);
  onKeyRef.current = onKey;
  useEffect(
    () =>
      listen<ToEditor>(async (msg, source) => {
        if (source !== frame.current?.contentWindow) return;
        if (msg.type === "ready") setCanvasReady((n) => n + 1);
        else if (msg.type === "select") {
          if (msg.add && msg.path) toggle(msg.path);
          else select(msg.path);
        }
        else if (msg.type === "key") onKeyRef.current(msg);
        else if (msg.type === "move") {
          if (canReorder) act((d) => moveNextTo(d, msg.from, msg.target, msg.position));
        }
        else if (msg.type === "text") {
          if (!may(grant, "text")) return setStatus("Your role can't edit texts");
          const rich = msg.kind === "pt";
          writeField(msg.path, msg.field, msg.pt ?? (rich ? plainToPt(msg.value) : msg.value), rich ? "rich" : "text", `text:${msg.path}.${msg.field}`);
        }
        else if (msg.type === "drop") {
          if (!may(grant, "images")) return setStatus("Your role can't change images");
          setStatus(`Uploading ${msg.file.name}…`);
          try {
            writeField(msg.path, msg.field, await upload(msg.file), "image");
            setStatus("Image uploaded");
          } catch (e) {
            setStatus(`Upload failed: ${(e as Error).message}`);
          }
        }
      }),
    [act, canReorder, grant, setField, upload, writeField],
  );

  // ── Editor → canvas: every local edit re-renders the canvas immediately.
  useEffect(() => {
    if (canvasReady && doc) post(frame.current?.contentWindow, { type: "render", doc, routes, components });
  }, [canvasReady, doc, routes, components]);
  useEffect(() => {
    const paths = selectionRef.current;
    if (canvasReady) post(frame.current?.contentWindow, { type: "select", path: paths.at(-1) ?? null, paths });
  }, [canvasReady]);

  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(null), /failed|couldn't/i.test(status) ? 8000 : 3000); // errors stay longer
    return () => clearTimeout(t);
  }, [status]);

  const target = useMemo(() => (doc && selected ? resolveSelection(doc, selected) : null), [doc, selected]);
  const type = target ? (schema.get(target.item._type) as ObjectSchemaType | undefined) : undefined;
  const tree = useMemo(
    () => (doc ? layers(doc).map((n) => (n.type === "componentRef" ? { ...n, title: `◆ ${components[n.ref ?? ""]?.title ?? "Missing component"}` } : n)) : []),
    [doc, components],
  );
  const addable = useMemo(() => (doc ? blockTypes.filter((t) => mayAdd(grant, t) && insertTarget(doc, selected, t)) : []), [doc, grant, selected]);
  const invalid = validation.find((m) => m.level === "error");
  const publishDisabled = !may(grant, "publish")
    ? "Your role doesn't publish — a teammate will"
    : invalid
      ? `Fix before publishing: ${invalid.message}`
      : ops.publish.disabled;
  // Publish runs in the background: say how it went (a failure used to look like success).
  useEffect(() => {
    if (opEvent?.op !== "publish") return;
    setStatus(opEvent.type === "error" ? `Publish failed: ${opEvent.error.message}` : "Published — the site rebuilds now");
  }, [opEvent]);
  const applyChat = useCallback(
    (proposed: unknown[], images: AttachedImages) => {
      const d = docRef.current;
      if (!d) return { doc: {} as Doc, applied: [], rejected: ["The page isn't loaded yet"], touched: [] };
      const res = applyOps(d, proposed, { catalog, grant, images, pages: pages.map((p) => ({ id: p._id, slug: p.slug, title: p.title })) });
      if (res.applied.length) {
        setSections(res.doc);
        if (res.touched.length) selectPaths(res.touched.filter((p) => resolveSelection(res.doc, p)), true);
      }
      return res;
    },
    [catalog, grant, pages, selectPaths, setSections],
  );

  return (
    <>
      <aside style={{ ...column, borderRight: border, display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <div style={heading}>{docType === "component" ? "Editing component ◆" : "Pages"}</div>
          <select style={{ ...select_ }} value={id} onChange={(e) => onPage(e.target.value)}>
            <optgroup label="Pages">
              {pages.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.title || p.slug} — {pageHref(p.slug)}
                </option>
              ))}
            </optgroup>
            {Object.keys(components).length ? (
              <optgroup label="Components">
                {Object.entries(components).map(([cid, c]) => (
                  <option key={cid} value={cid}>
                    ◆ {c.title || cid}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ ...heading, flex: 1 }}>Layers</div>
          </div>
          {doc ? (
            <Layers
              nodes={tree}
              depth={0}
              selected={selected}
              selection={selection}
              onSelect={(p, add) => (add ? toggle(p) : select(p, true))}
              canDrag={canReorder}
              onMove={(from, toArray, index) => {
                // Reorder-only roles stay within the same list.
                if (!canStructure && from.slice(0, from.lastIndexOf("[")) !== toArray) return setStatus("Your role can only reorder within the same group");
                act((d) => move(d, from, toArray, index));
              }}
              canDrop={(type, arrayPath) => !!docRef.current && canPlace(docRef.current, type, arrayPath)}
            />
          ) : null}
        </div>
      </aside>

      <main style={{ display: "flex", flexDirection: "column", minHeight: 0, background: "color-mix(in srgb, currentColor 6%, transparent)" }}>
        <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "8px 12px", borderBottom: border, position: "relative" }}>
          {(Object.keys(DEVICES) as (keyof typeof DEVICES)[]).map((d) => (
            <button key={d} type="button" onClick={() => setDevice(d)} style={{ ...chip, ...(device === d ? chipOn : null) }}>
              {d}
            </button>
          ))}
          <span style={{ width: 8 }} />
          <button type="button" onClick={undo} disabled={!past.current.length} style={{ ...chip, opacity: past.current.length ? 1 : 0.4 }} title="Undo (⌘Z)">
            ↶
          </button>
          <button type="button" onClick={redo} disabled={!future.current.length} style={{ ...chip, opacity: future.current.length ? 1 : 0.4 }} title="Redo (⌘⇧Z)">
            ↷
          </button>
          {canStructure && addable.length ? (
            <button type="button" onClick={() => setAdding((a) => !a)} style={chip} title="Add a block after the selection (or inside it)">
              + Add
            </button>
          ) : null}
          {adding ? (
            <div style={{ position: "absolute", top: 40, left: 220, zIndex: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, padding: 8, borderRadius: STUDIO_RADIUS_PANEL, border, background: "var(--card-bg-color, #fff)", color: "inherit", boxShadow: "0 8px 30px #0003", width: 300 }}>
              {doc && mayAdd(grant, "componentRef") && insertTarget(doc, selected, "componentRef")
                ? Object.entries(components).map(([cid, c]) => (
                    <button key={cid} type="button" onClick={() => addInstance(cid)} style={{ ...chip, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis" }}>
                      ◆ {c.title || cid}
                    </button>
                  ))
                : null}
              {addable.filter((t) => t !== "componentRef").map((t) => (
                <button key={t} type="button" onClick={() => doAdd(t)} style={{ ...chip, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {blockMeta(t)?.title ?? t}
                </button>
              ))}
            </div>
          ) : null}
          <span style={{ flex: 1 }} />
          <span style={{ opacity: 0.6, fontSize: 12 }}>{status ?? (!ready ? "Loading…" : draft && invalid ? `Can't publish yet: ${invalid.message}` : draft ? "Unpublished changes" : "Published")}</span>
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
        {conflict ? (
          <div role="alert" style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderBottom: border, fontSize: 12, background: "color-mix(in srgb, #f5a524 18%, transparent)" }}>
            <span style={{ flex: 1 }}>
              Someone else is editing this page. You see their changes, but if you both edit at the same moment the last save wins — agree on who edits. Undo was reset so it can't revert their work.
            </span>
            <button type="button" onClick={() => setConflict(false)} style={chip}>
              OK
            </button>
          </div>
        ) : null}
        <div style={{ flex: 1, minHeight: 0, display: "flex", justifyContent: "center", overflow: "auto" }}>
          <iframe ref={frame} src={CANVAS_PATH} title="Canvas" style={{ width: DEVICES[device], height: "100%", border: 0, background: "#fff", transition: "width 200ms ease" }} />
        </div>
        <div style={{ padding: "4px 12px", borderTop: border, fontSize: 11, opacity: 0.55 }}>
          Click to select · double-click text to edit · drop an image on an image · ⌘Z / ⌘⇧Z · ⌘D duplicate · ⌘C ⌘V · ⌫ delete · ⌥↑↓ move · Esc parent
        </div>
      </main>

      <aside style={{ ...column, borderLeft: border, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          <button type="button" onClick={() => setTab("properties")} style={{ ...chip, ...(tab === "properties" ? chipOn : null) }}>
            Properties
          </button>
          {canChat ? (
            <button type="button" onClick={() => setTab("chat")} style={{ ...chip, ...(tab === "chat" ? chipOn : null) }}>
              ✦ Chat
            </button>
          ) : null}
          <span style={{ flex: 1 }} />
          {isAdmin ? (
            <select
              value={viewAs ?? ""}
              onChange={(e) => setViewAs(e.target.value || null)}
              style={{ ...select_, width: "auto", maxWidth: "100%", padding: "3px 6px", fontSize: 12 }}
              title="Preview the editor (and the chat) as another role — src/okapi.policy.ts"
            >
              <option value="">View as: me</option>
              {Object.entries(POLICY).map(([role, r]) => (
                <option key={role} value={role}>
                  View as: {r.label}
                </option>
              ))}
            </select>
          ) : null}
        </div>
        {canChat && chatOpened.current ? (
          <div style={{ display: tab === "chat" ? "flex" : "none", flexDirection: "column", flex: 1, minHeight: 0 }}>
          <EditorChat
            client={client}
            documentId={id}
            catalog={catalog}
            grant={grant}
            viewAs={viewAs}
            selection={selection}
            upload={upload}
            onApply={applyChat}
            onUndo={undo}
          />
          </div>
        ) : null}
        {tab === "chat" && canChat ? null : (
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {target ? <div style={{ ...heading, margin: "0 0 10px" }}>{type?.title ?? target.item._type}</div> : null}
        {selection.length > 1 ? (
          <>
            <p style={{ margin: "0 0 10px", opacity: 0.8 }}>{selection.length} blocks selected</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {canReorder ? (
                <>
                  <button type="button" onClick={() => doNudge(-1)} style={chip}>▲</button>
                  <button type="button" onClick={() => doNudge(1)} style={chip}>▼</button>
                </>
              ) : null}
              <button type="button" onClick={doCopy} style={chip}>Copy</button>
              {canStructure ? (
                <>
                  <button type="button" onClick={doDuplicate} style={chip}>Duplicate</button>
                  <button type="button" onClick={doRemove} style={{ ...chip, color: "#e5484d" }}>Delete</button>
                </>
              ) : null}
              <button type="button" onClick={() => select(null)} style={chip}>Clear</button>
            </div>
            <p style={{ marginTop: 10, fontSize: 11, opacity: 0.55 }}>Shift/⌘-click to add or remove blocks.</p>
          </>
        ) : target ? (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 12 }}>
              <button type="button" onClick={() => select(parentBlock(selected!), true)} style={chip} disabled={!parentBlock(selected!)}>
                ↑ Parent
              </button>
              {canReorder ? (
                <>
                  <button type="button" onClick={() => doNudge(-1)} style={chip} title="Move up (⌥↑)">
                    ▲
                  </button>
                  <button type="button" onClick={() => doNudge(1)} style={chip} title="Move down (⌥↓)">
                    ▼
                  </button>
                </>
              ) : null}
              {FEATURES.components && may(grant, "components") && target.item._type === "section" && docType === "page" ? (
                <button type="button" onClick={makeComponent} style={chip} title="Save this section to the library and use it as a component">
                  Make component
                </button>
              ) : null}
              {target.item._type === "componentRef" && (target.item.component as { _ref?: string } | undefined)?._ref ? (
                <>
                  {may(grant, "components") ? (
                    <button type="button" onClick={() => onPage((target.item.component as { _ref: string })._ref)} style={chip}>
                      Edit component
                    </button>
                  ) : null}
                  {may(grant, "components") ? (
                    <button type="button" onClick={detach} style={chip} title="Replace this instance with an editable copy">
                      Detach
                    </button>
                  ) : null}
                </>
              ) : null}
              {canStructure ? (
                <>
                  <button type="button" onClick={doDuplicate} style={chip} title="⌘D">
                    Duplicate
                  </button>
                  <button type="button" onClick={doRemove} style={{ ...chip, color: "#e5484d" }} title="⌫">
                    Delete
                  </button>
                </>
              ) : null}
            </div>
            {target.item._type === "componentRef" && (target.item.overrides as Override[] | undefined)?.length ? (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, opacity: 0.85 }}>This instance overrides</div>
                {(target.item.overrides as Override[]).map((o) => (
                  <div key={o._key ?? o.target} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 0", fontSize: 12 }}>
                    <span style={{ flex: 1, opacity: 0.8 }}>{o.target?.split(".")[1]} · {o.text ? `“${o.text.slice(0, 24)}”` : o.rich ? "rich text" : "image"}</span>
                    <button
                      type="button"
                      style={chip}
                      onClick={() =>
                        setField(`${selected}.overrides`, (target.item.overrides as Override[]).filter((x) => x.target !== o.target))
                      }
                    >
                      Reset
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            {type ? (
              <FieldList type={type} value={target.item as Record<string, unknown>} basePath={selected!} onChange={(p, v) => setField(p, v)} grant={grant} />
            ) : (
              <p style={{ opacity: 0.6 }}>Unknown block type “{target.item._type}”.</p>
            )}
          </>
        ) : (
          <p style={{ opacity: 0.6, margin: 0 }}>Click anything on the canvas — or a layer — to edit it.</p>
        )}
        </div>
        )}
      </aside>
    </>
  );
}

// ── Resizable side columns (widths remembered per browser)
const COLS_KEY = "okapi:editor-columns";
const COLS = { left: { min: 180, max: 480, initial: 240 }, right: { min: 280, max: 720, initial: 340 } } as const;
const clampCol = (side: keyof typeof COLS, w: number) => Math.round(Math.min(COLS[side].max, Math.max(COLS[side].min, w)));
function readCols(): { left: number; right: number } {
  try {
    const v = JSON.parse(localStorage.getItem(COLS_KEY) ?? "{}") as { left?: number; right?: number };
    return { left: clampCol("left", v.left ?? COLS.left.initial), right: clampCol("right", v.right ?? COLS.right.initial) };
  } catch {
    return { left: COLS.left.initial, right: COLS.right.initial };
  }
}

/** Drag a column edge to resize it; double-click resets. Pointer capture keeps the drag going over the canvas iframe. */
function Resizer({ side, width, onChange }: { side: keyof typeof COLS; width: number; onChange: (w: number) => void }) {
  const [active, setActive] = useState(false);
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={side === "left" ? "Resize pages and layers" : "Resize properties and chat"}
      title="Drag to resize · double-click to reset"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setActive(true);
      }}
      onPointerMove={(e) => {
        if (!active) return;
        const box = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
        onChange(clampCol(side, side === "left" ? e.clientX - box.left : box.right - e.clientX));
      }}
      onPointerUp={() => setActive(false)}
      onDoubleClick={() => onChange(COLS[side].initial)}
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        [side]: width - 4,
        width: 8,
        cursor: "col-resize",
        zIndex: 5,
        touchAction: "none",
        background: active ? `color-mix(in srgb, ${STUDIO_ACCENT} 45%, transparent)` : "transparent",
      }}
    />
  );
}

/** Layers tree with drag & drop (before / after / inside), validated against the registry. */
function Layers({
  nodes,
  depth,
  selected,
  selection,
  onSelect,
  onMove,
  canDrop,
  canDrag,
}: {
  nodes: LayerNode[];
  depth: number;
  selected: string | null;
  onSelect: (path: string, add: boolean) => void;
  selection?: string[];
  onMove: (from: string, toArray: string, index: number) => void;
  canDrop: (type: string, arrayPath: string) => boolean;
  canDrag: boolean;
}) {
  const [over, setOver] = useState<{ path: string; zone: "before" | "after" | "inside" } | null>(null);
  const zoneOf = (e: React.DragEvent, n: LayerNode): "before" | "after" | "inside" => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = (e.clientY - r.top) / r.height;
    if (n.childArray && y > 0.3 && y < 0.7) return "inside";
    return y < 0.5 ? "before" : "after";
  };
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {nodes.map((n) => {
        const parentArray = n.path.slice(0, n.path.lastIndexOf("["));
        return (
          <li key={n.path}>
            <div
              draggable={canDrag}
              onDragStart={(e) => {
                e.dataTransfer.setData("text/x-layer", JSON.stringify({ path: n.path, type: n.type }));
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(e) => {
                const raw = [...e.dataTransfer.types].includes("text/x-layer");
                if (!raw) return;
                e.preventDefault();
                setOver({ path: n.path, zone: zoneOf(e, n) });
              }}
              onDragLeave={() => setOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                const data = e.dataTransfer.getData("text/x-layer");
                if (!data) return;
                const { path: from, type } = JSON.parse(data) as { path: string; type: string };
                if (from === n.path) return;
                const zone = zoneOf(e, n);
                const toArray = zone === "inside" ? n.childArray! : parentArray;
                if (!canDrop(type, toArray)) return;
                // Index in the target array once `from` has been removed from it.
                const siblings = (zone === "inside" ? n.children : nodes).map((x) => x.path).filter((p) => p !== from);
                const index = zone === "inside" ? siblings.length : siblings.indexOf(n.path) + (zone === "after" ? 1 : 0);
                onMove(from, toArray, index);
              }}
              onClick={(e) => onSelect(n.path, e.shiftKey || e.metaKey || e.ctrlKey)}
              style={{
                padding: `5px 8px 5px ${8 + depth * 14}px`,
                borderRadius: STUDIO_RADIUS_CONTROL,
                cursor: "pointer",
                userSelect: "none",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                fontWeight: n.type === "section" ? 600 : 400,
                background: selected === n.path ? STUDIO_ACCENT : selection?.includes(n.path) ? `color-mix(in srgb, ${STUDIO_ACCENT} 55%, transparent)` : over?.path === n.path && over.zone === "inside" ? `color-mix(in srgb, ${STUDIO_ACCENT} 25%, transparent)` : "transparent",
                color: selected === n.path || selection?.includes(n.path) ? "#fff" : "inherit",
                boxShadow:
                  over?.path === n.path && over.zone === "before" ? `inset 0 2px 0 ${STUDIO_ACCENT}` : over?.path === n.path && over.zone === "after" ? `inset 0 -2px 0 ${STUDIO_ACCENT}` : undefined,
              }}
              title={n.title}
            >
              {n.title}
            </div>
            {n.children.length ? (
              <Layers nodes={n.children} depth={depth + 1} selected={selected} selection={selection} onSelect={onSelect} onMove={onMove} canDrop={canDrop} canDrag={canDrag} />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

const border = "1px solid color-mix(in srgb, currentColor 14%, transparent)";
const column = { padding: 12, overflowY: "auto", minHeight: 0 } as const;
const heading = { fontWeight: 600, margin: "4px 4px 8px" } as const;
const chip = { padding: "4px 10px", font: "inherit", fontSize: 12, color: "inherit", cursor: "pointer", background: "transparent", border, borderRadius: STUDIO_RADIUS_CONTROL, whiteSpace: "nowrap", flexShrink: 0 } as const;
const chipOn = { background: STUDIO_ACCENT, borderColor: STUDIO_ACCENT, color: "#fff" } as const;
const select_ = { width: "100%", padding: "6px 8px", font: "inherit", fontSize: 13, color: "inherit", background: "transparent", border, borderRadius: STUDIO_RADIUS_CONTROL } as const;
