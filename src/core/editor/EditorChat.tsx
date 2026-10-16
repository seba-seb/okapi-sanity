import { useEffect, useRef, useState } from "react";
import type { SanityClient } from "sanity";

import type { ApplyResult, Catalog, ChatTurn, PageRef } from "./chat";
import type { Grant } from "./policy";

type Message = ChatTurn & { applied?: string[]; rejected?: string[]; error?: boolean };

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
  onApply,
  onUndo,
}: {
  client: SanityClient;
  documentId: string;
  catalog: Catalog;
  grant: Grant;
  viewAs: string | null;
  selection: string[];
  onApply: (ops: unknown[]) => ApplyResult;
  onUndo: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  // Is the chat set up on this deployment? (GET /api/editor-chat)
  const [status, setStatus] = useState<{ available: boolean; provider?: string; model?: string; reason?: string } | null>(null);
  useEffect(() => {
    fetch(ENDPOINT)
      .then((r) => (r.ok ? r.json() : { available: false, reason: r.status === 404 ? "NO_ROUTE" : `HTTP ${r.status}` }))
      .then(setStatus, () => setStatus({ available: false, reason: "NO_ROUTE" }));
  }, []);
  const end = useRef<HTMLDivElement>(null);
  // Braces matter: newer browsers return a Promise from scrollIntoView, and an
  // effect that returns a non-function crashes React on unmount.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages, busy]);

  const send = async (text = input.trim()) => {
    if (!text || busy || !status?.available) return;
    setInput("");
    const history = messages.slice(-8).map(({ role, text }) => ({ role, text }));
    setMessages((m) => [...m, { role: "user", text }]);
    setBusy(true);
    try {
      const token = client.config().token;
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : null) },
        body: JSON.stringify({ documentId, request: text, selection, history, catalog, viewAs }),
      });
      const answer = (await res.json().catch(() => ({ error: `HTTP ${res.status}` }))) as { reply?: string; ops?: unknown[]; error?: string };
      if (!res.ok || answer.error) throw new Error(answer.error ?? `HTTP ${res.status}`);
      const done = answer.ops?.length ? onApply(answer.ops) : { applied: [], rejected: [] };
      setMessages((m) => [
        ...m,
        { role: "assistant", text: answer.reply || (done.applied.length ? "Done." : "I didn't change anything."), applied: done.applied, rejected: done.rejected },
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
        {status.reason === "NO_ROUTE" ? (
          <p style={{ margin: 0 }}>
            This site is deployed on a host that can't run its chat function. It works on Vercel, Netlify and Cloudflare Pages (and in{" "}
            <code>npm run dev</code>).
          </p>
        ) : (
          <p style={{ margin: 0 }}>
            {status.reason}. The agency sets <code>AI_PROVIDER</code> and <code>AI_API_KEY</code> in the hosting's environment variables and
            redeploys.
          </p>
        )}
      </div>
    );
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, opacity: 0.7, marginBottom: 8 }}>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {status.provider}
          {status.model ? ` · ${status.model}` : ""}
        </span>
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
                <button key={s} type="button" onClick={() => send(s)} style={{ ...chip, textAlign: "left" }}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {messages.map((m, i) => (
          <div key={i} style={m.role === "user" ? userBubble : { ...botBubble, ...(m.error ? { borderColor: "#e5484d" } : null) }}>
            <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
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
        style={{ display: "grid", gap: 6, paddingTop: 8, borderTop: border }}
      >
        <textarea
          rows={3}
          value={input}
          placeholder={selection.length ? "Change the selected block…" : "What should change on this page?"}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          style={{ width: "100%", boxSizing: "border-box", padding: 8, font: "inherit", fontSize: 13, color: "inherit", background: "transparent", border, borderRadius: 6, resize: "vertical" }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ flex: 1, fontSize: 11, opacity: 0.55 }}>{selection.length ? `${selection.length} selected` : "Nothing selected"} · Enter to send</span>
          <button type="submit" disabled={busy || !input.trim()} style={{ ...chip, ...chipOn, opacity: busy || !input.trim() ? 0.5 : 1 }}>
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

const ENDPOINT = "/api/editor-chat";
const border = "1px solid color-mix(in srgb, currentColor 14%, transparent)";
const chip = { padding: "4px 10px", font: "inherit", fontSize: 12, color: "inherit", cursor: "pointer", background: "transparent", border, borderRadius: 6 } as const;
const chipOn = { background: "#2f5bff", borderColor: "#2f5bff", color: "#fff" } as const;
const userBubble = { justifySelf: "end", maxWidth: "88%", padding: "7px 10px", borderRadius: 10, background: "#2f5bff", color: "#fff", fontSize: 13 } as const;
const botBubble = { maxWidth: "95%", padding: "7px 10px", borderRadius: 10, border, fontSize: 13 } as const;
const list = { margin: "6px 0 0", padding: 0, listStyle: "none", fontSize: 12, opacity: 0.85, display: "grid", gap: 2 } as const;
