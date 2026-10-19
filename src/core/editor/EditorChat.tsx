import { useEffect, useRef, useState } from "react";
import type { SanityClient } from "sanity";

import type { ApplyResult, AttachedImages, Catalog, ChatTurn } from "./chat";
import type { Grant } from "./policy";
import { STUDIO_ACCENT, STUDIO_RADIUS_CONTROL, STUDIO_RADIUS_PANEL } from "@/theme/studio";
import { sitePath } from "@/core/sanity/env";

type Message = ChatTurn & { applied?: string[]; rejected?: string[]; error?: boolean; model?: string; thumbs?: string[] };
/** An image attached to the next message: uploading to Sanity, plus a small copy for the model to see. */
type Pending = { id: string; name: string; preview: string; vision?: string; value?: unknown; error?: string };
const MAX_ATTACH = 3;

/** A downscaled JPEG data URL (longest side ≤ 1024px) — what the model sees; the original goes to Sanity. */
async function visionCopy(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1024 / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.8);
}
type Status = { available: boolean; models?: { id: string; label: string }[]; reason?: string };
const MODEL_PREF = "okapi:chat-model";
const readPref = () => {
  try {
    return localStorage.getItem(MODEL_PREF);
  } catch {
    return null;
  }
};

const SUGGESTIONS = [
  "Make the selected heading shorter and punchier",
  "Rewrite this paragraph in a friendlier tone",
  "Translate the texts of this section to English",
];

/**
 * The AI chat panel. It talks to the site's own server route
 * (/api/editor-chat, core/editor/server/chatRoute.ts) with the person's Sanity
 * session: the route checks who they are, reads the page and calls the model
 * with the project's key from the host's environment — the browser never sees
 * a key. The answer is a list of proposed ops; `onApply` validates them again
 * against the person's grant and applies them as one undo step (a draft).
 */
export function EditorChat({
  client,
  documentId,
  catalog,
  grant,
  viewAs,
  selection,
  upload,
  onApply,
  onUndo,
}: {
  client: SanityClient;
  documentId: string;
  catalog: Catalog;
  grant: Grant;
  viewAs: string | null;
  selection: string[];
  /** Uploads an image file to Sanity with the person's session → the image field value. */
  upload: (file: File) => Promise<unknown>;
  onApply: (ops: unknown[], images: AttachedImages) => ApplyResult;
  onUndo: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const canImages = grant.can.has("images");
  const uploading = pending.some((p) => !p.value && !p.error);

  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const nextId = useRef(1);
  const attach = (files: Iterable<File>) => {
    const room = MAX_ATTACH - pendingRef.current.length;
    for (const file of [...files].filter((f) => f.type.startsWith("image/")).slice(0, Math.max(0, room))) {
      const id = `img${nextId.current++}`;
      const patch = (p: Partial<Pending>) => setPending((all) => all.map((x) => (x.id === id ? { ...x, ...p } : x)));
      setPending((cur) => [...cur, { id, name: file.name, preview: URL.createObjectURL(file) }]);
      // Both start now, so Send isn't waiting on them later. No upload if the role can't place images.
      visionCopy(file).then((vision) => patch({ vision }), () => patch({}));
      (canImages ? upload(file) : Promise.resolve(false)).then(
        (value) => patch({ value }),
        (e) => patch({ error: (e as Error).message }),
      );
    }
  };

  // Is the chat set up on this deployment? (GET /api/editor-chat)
  const [status, setStatus] = useState<Status | null>(null);
  // The model picker: names come from the server (it holds the keys); the choice is remembered in this browser.
  const [modelId, setModelId] = useState<string | null>(readPref);
  const models = status?.models ?? [];
  const current = models.find((m) => m.id === modelId) ?? models[0];
  const pickModel = (id: string) => {
    setModelId(id);
    try {
      localStorage.setItem(MODEL_PREF, id);
    } catch {
      /* private mode: remembered for this session only */
    }
  };
  useEffect(() => {
    fetch(ENDPOINT)
      .then((r) => (r.ok ? r.json() : { available: false, reason: r.status === 404 ? (import.meta.env.DEV ? "NO_ROUTE_DEV" : "NO_ROUTE") : `HTTP ${r.status}` }))
      .then(setStatus, () => setStatus({ available: false, reason: "NO_ROUTE" }));
  }, []);
  const end = useRef<HTMLDivElement>(null);
  // Braces matter: newer browsers return a Promise from scrollIntoView, and an
  // effect that returns a non-function crashes React on unmount.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages, busy]);

  const send = async (text = input.trim()) => {
    if (!text || busy || uploading || !status?.available) return;
    const sent = pending.filter((p) => !p.error);
    setPending([]);
    nextId.current = 1;
    setInput("");
    const history = messages.slice(-8).map(({ role, text }) => ({ role, text }));
    setMessages((m) => [...m, { role: "user", text, thumbs: sent.map((p) => p.preview) }]);
    setBusy(true);
    try {
      const token = client.config().token;
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : null) },
        body: JSON.stringify({
          documentId,
          request: text,
          selection,
          history,
          catalog,
          viewAs,
          model: current?.id,
          images: sent.map((p) => ({ id: p.id, name: p.name, dataUrl: p.vision })),
        }),
      });
      const answer = (await res.json().catch(() => ({ error: `HTTP ${res.status}` }))) as { reply?: string; ops?: unknown[]; error?: string; model?: string };
      if (!res.ok || answer.error) throw new Error(answer.error ?? `HTTP ${res.status}`);
      const images: AttachedImages = Object.fromEntries(sent.filter((p) => p.value).map((p) => [p.id, p.value]));
      const done = answer.ops?.length ? onApply(answer.ops, images) : { applied: [], rejected: [] };
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: answer.reply || (done.applied.length ? "Done." : "I didn't change anything."),
          applied: done.applied,
          rejected: done.rejected,
          model: models.find((m) => m.id === answer.model)?.label,
        },
      ]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: (e as Error).message, error: true }]);
    } finally {
      setBusy(false);
    }
  };

  const lastApplied = [...messages].reverse().find((m) => m.applied?.length);
  if (!status) return <p style={{ fontSize: 12, opacity: 0.6 }}>Checking the chat…</p>;
  if (!status.available)
    return (
      <div style={{ fontSize: 12, display: "grid", gap: 8, opacity: 0.85 }}>
        <strong>The chat isn't available here</strong>
        {status.reason === "NO_ROUTE_DEV" ? (
          <p style={{ margin: 0 }}>
            <code>{ENDPOINT}</code> answered 404 in <code>npm run dev</code>, so the route isn't there: the chat is off in{" "}
            <code>src/okapi.config.json</code>, or <code>astro.config.mjs</code> changed (e.g. <code>trailingSlash</code>) and the dev server needs a restart.
          </p>
        ) : status.reason === "NO_ROUTE" ? (
          <p style={{ margin: 0 }}>
            This site is deployed on a host that can't run its chat function. It works on Vercel, Netlify and Cloudflare Pages (and in{" "}
            <code>npm run dev</code>).
          </p>
        ) : (
          <p style={{ margin: 0 }}>
            {status.reason}. The agency sets a key (<code>ANTHROPIC_API_KEY</code>, <code>OPENAI_API_KEY</code> or{" "}
            <code>OPENROUTER_API_KEY</code>) in the hosting's environment variables and redeploys.
          </p>
        )}
      </div>
    );
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, opacity: 0.85, marginBottom: 8 }}>
        <span>Model</span>
        <select
          id="chat-model"
          value={current?.id ?? ""}
          onChange={(e) => pickModel(e.target.value)}
          disabled={busy || models.length < 2}
          style={{ flex: 1, minWidth: 0, padding: "3px 6px", font: "inherit", fontSize: 12, color: "inherit", background: "transparent", border, borderRadius: STUDIO_RADIUS_CONTROL }}
          title="Models this site offers (set by the agency in the hosting)"
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", display: "grid", alignContent: "start", gap: 10, paddingBottom: 8 }}>
        {messages.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.75, display: "grid", gap: 8 }}>
            <p style={{ margin: 0 }}>
              Ask for changes in your own words. Select a block first to talk about “this”. Changes are saved as a draft and can be undone; you publish.
            </p>
            <p style={{ margin: 0, opacity: 0.8 }}>Your role: {grant.label}. The chat can do what you can — nothing more.</p>
            <div style={{ display: "grid", gap: 4 }}>
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} style={{ ...chip, textAlign: "left", whiteSpace: "normal" }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {messages.map((m, i) => (
          <div key={i} style={m.role === "user" ? userBubble : { ...botBubble, ...(m.error ? { borderColor: "#e5484d" } : null) }}>
            {m.thumbs?.length ? (
              <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                {m.thumbs.map((t) => (
                  <img key={t} src={t} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: STUDIO_RADIUS_CONTROL }} />
                ))}
              </div>
            ) : null}
            <div style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.text}</div>
            {m.model ? <div style={{ fontSize: 10, opacity: 0.5, marginTop: 4 }}>{m.model}</div> : null}
            {m.applied?.length ? (
              <ul style={list}>
                {m.applied.map((a, j) => (
                  <li key={j}>✓ {a}</li>
                ))}
              </ul>
            ) : null}
            {m.rejected?.length ? (
              <ul style={{ ...list, color: "#e5484d" }}>
                {m.rejected.map((r, j) => (
                  <li key={j}>✕ {r}</li>
                ))}
              </ul>
            ) : null}
            {m === lastApplied ? (
              <button type="button" onClick={onUndo} style={{ ...chip, marginTop: 6 }} title="Undo (⌘Z)">
                ↶ Undo these changes
              </button>
            ) : null}
          </div>
        ))}
        {busy ? <div style={{ ...botBubble, opacity: 0.6 }}>Thinking…</div> : null}
        <div ref={end} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          attach(e.dataTransfer.files);
        }}
        style={{ display: "grid", gap: 6, paddingTop: 8, borderTop: border }}
      >
        {pending.length ? (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {pending.map((p) => (
              <div key={p.id} style={{ position: "relative" }} title={p.error ?? (p.value ? `${p.name} — ${p.id}` : "Uploading…")}>
                <img src={p.preview} alt={p.name} style={{ width: 52, height: 52, objectFit: "cover", borderRadius: STUDIO_RADIUS_CONTROL, opacity: p.value || p.value === false ? 1 : 0.5, outline: p.error ? "2px solid #e5484d" : undefined }} />
                <button
                  type="button"
                  aria-label={`Remove ${p.name}`}
                  onClick={() => setPending((all) => all.filter((x) => x.id !== p.id))}
                  style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: 9, border: 0, background: "#000a", color: "#fff", fontSize: 11, cursor: "pointer", lineHeight: "18px", padding: 0 }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <textarea
          rows={3}
          value={input}
          placeholder={selection.length ? "Change the selected block…" : "What should change on this page?"}
          onChange={(e) => setInput(e.target.value)}
          onPaste={(e) => {
            if (e.clipboardData.files.length) {
              e.preventDefault();
              attach(e.clipboardData.files);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          style={{ width: "100%", boxSizing: "border-box", padding: 8, font: "inherit", fontSize: 13, color: "inherit", background: "transparent", border, borderRadius: STUDIO_RADIUS_CONTROL, resize: "vertical" }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            ref={fileInput}
            id="chat-attach"
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files) attach(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={pending.length >= MAX_ATTACH}
            style={{ ...chip, padding: "4px 8px" }}
            title={canImages ? "Attach an image (or paste / drop it here) — to use on the page or as a reference" : "Attach an image as a reference (your role can't place images)"}
          >
            📎
          </button>
          <span style={{ flex: 1, fontSize: 11, opacity: 0.55 }}>
            {uploading ? "Uploading image…" : `${selection.length ? `${selection.length} selected` : "Nothing selected"} · Enter to send`}
          </span>
          <button type="submit" disabled={busy || uploading || !input.trim()} style={{ ...chip, ...chipOn, opacity: busy || uploading || !input.trim() ? 0.5 : 1 }}>
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

const ENDPOINT = sitePath("/api/editor-chat");
const border = "1px solid color-mix(in srgb, currentColor 14%, transparent)";
const chip = { padding: "4px 10px", font: "inherit", fontSize: 12, color: "inherit", cursor: "pointer", background: "transparent", border, borderRadius: STUDIO_RADIUS_CONTROL, whiteSpace: "nowrap", flexShrink: 0 } as const;
const chipOn = { background: STUDIO_ACCENT, borderColor: STUDIO_ACCENT, color: "#fff" } as const;
const userBubble = { justifySelf: "end", maxWidth: "88%", padding: "7px 10px", borderRadius: STUDIO_RADIUS_PANEL, background: STUDIO_ACCENT, color: "#fff", fontSize: 13 } as const;
const botBubble = { maxWidth: "95%", padding: "7px 10px", borderRadius: STUDIO_RADIUS_PANEL, border, fontSize: 13 } as const;
const list = { margin: "6px 0 0", padding: 0, listStyle: "none", fontSize: 12, opacity: 0.85, display: "grid", gap: 2 } as const;
