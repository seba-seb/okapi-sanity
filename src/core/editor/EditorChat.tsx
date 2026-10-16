import { useEffect, useRef, useState } from "react";
import type { SanityClient } from "sanity";

import { buildInstruction, parseAnswer, type ApplyResult, type Catalog, type ChatTurn, type PageRef } from "./chat";
import type { Grant } from "./policy";
import type { Doc } from "./ops";

type Message = ChatTurn & { applied?: string[]; rejected?: string[]; error?: boolean };

const SUGGESTIONS = [
  "Make the selected heading shorter and punchier",
  "Rewrite this paragraph in a friendlier tone",
  "Translate the texts of this section to English",
];

/**
 * The AI chat panel. The model runs through Sanity Agent Actions (`prompt`),
 * with the signed-in person's session: no server, no API key in the project,
 * usage counted on the Sanity project. It only proposes ops — `onApply`
 * validates them against the person's grant and applies them as one undo step.
 */
export function EditorChat({
  client,
  doc,
  catalog,
  grant,
  selection,
  pages,
  onApply,
  onUndo,
}: {
  client: SanityClient;
  doc: Doc | null;
  catalog: Catalog;
  grant: Grant;
  selection: string[];
  pages: PageRef[];
  onApply: (ops: unknown[]) => ApplyResult;
  onUndo: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  // Braces matter: newer browsers return a Promise from scrollIntoView, and an
  // effect that returns a non-function crashes React on unmount.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages, busy]);

  const send = async (text = input.trim()) => {
    if (!text || busy || !doc) return;
    setInput("");
    const history = messages.slice(-8).map(({ role, text }) => ({ role, text }));
    setMessages((m) => [...m, { role: "user", text }]);
    setBusy(true);
    try {
      const instruction = buildInstruction({ doc, catalog, grant, selection, pages, history, request: text });
      const raw = await client.withConfig({ apiVersion: "vX" }).agent.action.prompt({ instruction, format: "json", temperature: 0.2 });
      const answer = parseAnswer(raw);
      const res = answer.ops.length ? onApply(answer.ops) : { applied: [], rejected: [] };
      setMessages((m) => [
        ...m,
        { role: "assistant", text: answer.reply || (res.applied.length ? "Done." : "I didn't change anything."), applied: res.applied, rejected: res.rejected },
      ]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", text: explain(e), error: true }]);
    } finally {
      setBusy(false);
    }
  };

  const lastApplied = [...messages].reverse().find((m) => m.applied?.length);
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
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

function explain(e: unknown): string {
  const err = e as { statusCode?: number; message?: string };
  if (err.statusCode === 401) return "Your Sanity session expired. Reload the Studio and sign in again.";
  if (err.statusCode === 403) return "AI isn't available for this Sanity project: Agent Actions are turned off for the organization or not included in its plan (sanity.io/manage).";
  if (err.statusCode === 429) return "The Sanity project hit its AI usage limit. Try again later or check the plan in sanity.io/manage.";
  return `The AI request failed: ${err.message ?? String(e)}`;
}

const border = "1px solid color-mix(in srgb, currentColor 14%, transparent)";
const chip = { padding: "4px 10px", font: "inherit", fontSize: 12, color: "inherit", cursor: "pointer", background: "transparent", border, borderRadius: 6 } as const;
const chipOn = { background: "#2f5bff", borderColor: "#2f5bff", color: "#fff" } as const;
const userBubble = { justifySelf: "end", maxWidth: "88%", padding: "7px 10px", borderRadius: 10, background: "#2f5bff", color: "#fff", fontSize: 13 } as const;
const botBubble = { maxWidth: "95%", padding: "7px 10px", borderRadius: 10, border, fontSize: 13 } as const;
const list = { margin: "6px 0 0", padding: 0, listStyle: "none", fontSize: 12, opacity: 0.85, display: "grid", gap: 2 } as const;
