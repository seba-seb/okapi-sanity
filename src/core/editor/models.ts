/**
 * Bring your own model: the chat calls the person's own AI provider straight
 * from their browser, with their own key. The key is stored only in that
 * browser (localStorage) and sent only to the provider — never to Sanity,
 * the repo or any server of ours. "sanity" uses Sanity Agent Actions with the
 * person's session instead (no key, usage on the Sanity project).
 */
export const PROVIDERS = {
  anthropic: { label: "Anthropic (Claude)", model: "claude-sonnet-5-5", keyHint: "sk-ant-…" },
  openai: { label: "OpenAI", model: "gpt-4.1-mini", keyHint: "sk-…" },
  openrouter: { label: "OpenRouter (any model)", model: "anthropic/claude-sonnet-5.5", keyHint: "sk-or-…" },
  sanity: { label: "Sanity Agent Actions (no key)", model: "", keyHint: "" },
} as const;
export type Provider = keyof typeof PROVIDERS;
export type ModelConfig = { provider: Provider; model: string; apiKey: string };

const STORAGE = "remarkable:ai-model";
export function loadModelConfig(): ModelConfig | null {
  try {
    const v = JSON.parse(localStorage.getItem(STORAGE) ?? "null") as ModelConfig | null;
    return v && v.provider in PROVIDERS ? v : null;
  } catch {
    return null;
  }
}
export function saveModelConfig(cfg: ModelConfig | null) {
  try {
    if (cfg) localStorage.setItem(STORAGE, JSON.stringify(cfg));
    else localStorage.removeItem(STORAGE);
  } catch {
    /* private mode: the config lives for this session only */
  }
}

/** The HTTP request for a provider (pure, so a check can assert its shape). */
export function buildRequest(cfg: ModelConfig, instruction: string): { url: string; init: RequestInit } {
  const model = cfg.model || PROVIDERS[cfg.provider].model;
  if (cfg.provider === "anthropic")
    return {
      url: "https://api.anthropic.com/v1/messages",
      init: {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": cfg.apiKey,
          "anthropic-version": "2023-06-01",
          // The key is the person's own, entered in their browser: direct calls are intended.
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({ model, max_tokens: 4096, temperature: 0.2, messages: [{ role: "user", content: instruction }] }),
      },
    };
  const url = cfg.provider === "openai" ? "https://api.openai.com/v1/chat/completions" : "https://openrouter.ai/api/v1/chat/completions";
  return {
    url,
    init: {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({ model, temperature: 0.2, response_format: { type: "json_object" }, messages: [{ role: "user", content: instruction }] }),
    },
  };
}

/** The model's text out of a provider response body. */
export function readResponse(provider: Provider, body: unknown): string {
  const b = body as { content?: { type: string; text?: string }[]; choices?: { message?: { content?: string } }[] };
  if (provider === "anthropic") return (b.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  return b.choices?.[0]?.message?.content ?? "";
}

/** Ask the person's own model. Throws with the provider's error message. */
export async function askOwnModel(cfg: ModelConfig, instruction: string): Promise<string> {
  const { url, init } = buildRequest(cfg, instruction);
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body as { error?: { message?: string } | string }).error;
    const text = typeof msg === "string" ? msg : msg?.message;
    throw Object.assign(new Error(`${PROVIDERS[cfg.provider].label}: ${text ?? res.statusText}`), { statusCode: res.status, provider: cfg.provider });
  }
  return readResponse(cfg.provider, body);
}
