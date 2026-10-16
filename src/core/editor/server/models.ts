/**
 * The AI providers the editor chat's server route can call (server only: the
 * key comes from the host's environment and never reaches the browser).
 * "sanity" = Sanity Agent Actions with the person's session (no key; usage in
 * the Sanity project's AI credits).
 */
export const PROVIDERS = {
  anthropic: { label: "Anthropic (Claude)", model: "claude-sonnet-5-5" },
  openai: { label: "OpenAI", model: "gpt-4.1-mini" },
  openrouter: { label: "OpenRouter (any model)", model: "anthropic/claude-sonnet-5.5" },
  sanity: { label: "Sanity Agent Actions (no key)", model: "" },
} as const;
export type Provider = keyof typeof PROVIDERS;
export type ModelConfig = { provider: Provider; model: string; apiKey: string };

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

/** Ask the project's model. Throws with the provider's error message. */
export async function askModel(cfg: ModelConfig, instruction: string): Promise<string> {
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
