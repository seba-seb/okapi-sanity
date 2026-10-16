import { useEffect, useRef, useState } from "react";
import type { SanityClient } from "sanity";

import { buildInstruction, parseAnswer, type ApplyResult, type Catalog, type ChatTurn, type PageRef } from "./chat";
import type { Grant } from "./policy";
import type { Doc } from "./ops";
import { askOwnModel, loadModelConfig, PROVIDERS, saveModelConfig, type ModelConfig, type Provider } from "./models";

type Message = ChatTurn & { applied?: string[]; rejected?: string[]; error?: boolean };

const SUGGESTIONS = [
  "Make the selected heading shorter and punchier",
  "Rewrite this paragraph in a friendlier tone",
  "Translate the texts of this section to English",
];

/**
 * The AI chat panel. Each person brings their own model (models.ts): their key,
 * stored only in their browser and sent only to their provider — or Sanity
 * Agent Actions with their session. The model only proposes ops — `onApply`
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
  const [model, setModel] = useState<ModelConfig | null>(() => loadModelConfig());
  const [settingsOpen, setSettingsOpen] = useState(() => !loadModelConfig());
  const end = useRef<HTMLDivElement>(null);
  // Braces matter: newer browsers return a Promise from scrollIntoView, and an
  // effect that returns a non-function crashes React on unmount.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages, busy]);

  const send = async (text = input.trim()) => {
    if (!text || busy || !doc) return;
    if (!model) return setSettingsOpen(true);
    setInput("");
    const history = messages.slice(-8).map(({ role, text }) => ({ role, text }));
    setMessages((m) => [...m, { role: "user", text }]);
    setBusy(true);
    try {
      const instruction = buildInstruction({ doc, catalog, grant, selection, pages, history, request: text });
      const raw =
        model.provider === "sanity"
          ? await client.withConfig({ apiVersion: "vX" }).agent.action.prompt({ instruction, format: "json", temperature: 0.2 })
          : await askOwnModel(model, instruction);
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
  if (settingsOpen)
    return (
      <ModelSettings
        value={model}
        onSave={(cfg) => {
          saveModelConfig(cfg);
          setModel(cfg);
          setSettingsOpen(!cfg);
        }}
        onCancel={model ? () => setSettingsOpen(false) : undefined}
      />
    );
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, opacity: 0.7, marginBottom: 8 }}>
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {PROVIDERS[model!.provider].label}
          {model!.model ? ` · ${model!.model}` : ""}
        </span>
        <button type="button" onClick={() => setSettingsOpen(true)} style={{ ...chip, padding: "2px 8px", fontSize: 11 }}>
          Model
        </button>
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

/** Pick the provider, model and key. The key never leaves this browser except to the provider. */
function ModelSettings({ value, onSave, onCancel }: { value: ModelConfig | null; onSave: (cfg: ModelConfig | null) => void; onCancel?: () => void }) {
  const [provider, setProvider] = useState<Provider>(value?.provider ?? "anthropic");
  const [model, setModel] = useState(value?.model ?? "");
  const [apiKey, setApiKey] = useState(value?.apiKey ?? "");
  const needsKey = provider !== "sanity";
  const p = PROVIDERS[provider];
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (needsKey && !apiKey.trim()) return;
        onSave({ provider, model: model.trim(), apiKey: needsKey ? apiKey.trim() : "" });
      }}
      style={{ display: "grid", gap: 12, fontSize: 13 }}
    >
      <div style={{ fontWeight: 600 }}>Connect your AI</div>
      <p style={{ margin: 0, fontSize: 12, opacity: 0.75 }}>
        Use your own provider and key. The key is saved only in this browser and sent only to {needsKey ? p.label : "nobody"} — never to Sanity, the
        site or the agency.
      </p>
      <label style={{ display: "grid", gap: 4 }}>
        <span style={label}>Provider</span>
        <select id="ai-provider" value={provider} onChange={(e) => setProvider(e.target.value as Provider)} style={field}>
          {(Object.keys(PROVIDERS) as Provider[]).map((k) => (
            <option key={k} value={k}>
              {PROVIDERS[k].label}
            </option>
          ))}
        </select>
      </label>
      {needsKey ? (
        <>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={label}>Model</span>
            <input id="ai-model" value={model} placeholder={p.model} onChange={(e) => setModel(e.target.value)} style={field} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>
            <span style={label}>API key</span>
            <input id="ai-key" type="password" autoComplete="off" value={apiKey} placeholder={p.keyHint} onChange={(e) => setApiKey(e.target.value)} style={field} />
          </label>
        </>
      ) : (
        <p style={{ margin: 0, fontSize: 12, opacity: 0.75 }}>Runs with your Sanity session; usage counts on the Sanity project. The organization must have AI enabled.</p>
      )}
      <div style={{ display: "flex", gap: 6 }}>
        <button type="submit" disabled={needsKey && !apiKey.trim()} style={{ ...chip, ...chipOn, opacity: needsKey && !apiKey.trim() ? 0.5 : 1 }}>
          Save
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} style={chip}>
            Cancel
          </button>
        ) : null}
        <span style={{ flex: 1 }} />
        {value ? (
          <button type="button" onClick={() => onSave(null)} style={{ ...chip, color: "#e5484d" }} title="Delete the saved key from this browser">
            Forget key
          </button>
        ) : null}
      </div>
    </form>
  );
}

function explain(e: unknown): string {
  const err = e as { statusCode?: number; message?: string; provider?: string };
  if (err.provider) {
    if (err.statusCode === 401 || err.statusCode === 403) return `${err.message}
Check the API key (Model → API key).`;
    if (err.statusCode === 404) return `${err.message}
Check the model name (Model → Model).`;
    if (err.statusCode === 429) return `${err.message}
Rate or credit limit on your provider account.`;
    return err.message ?? String(e);
  }
  if (err.message === "Failed to fetch") return "Couldn't reach the AI provider (network, or the provider blocks browser requests).";
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
const label = { fontSize: 12, fontWeight: 600, opacity: 0.85 } as const;
const field = { width: "100%", boxSizing: "border-box", padding: "6px 8px", font: "inherit", fontSize: 13, color: "inherit", background: "transparent", border, borderRadius: 6 } as const;
const list = { margin: "6px 0 0", padding: 0, listStyle: "none", fontSize: 12, opacity: 0.85, display: "grid", gap: 2 } as const;
