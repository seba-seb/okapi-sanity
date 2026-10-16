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

/** Offered in the chat's model picker when AI_MODELS isn't set (for every provider that has a key). */
export const DEFAULT_MODELS: Record<Exclude<Provider, "sanity">, string[]> = {
  anthropic: ["claude-sonnet-5-5", "claude-opus-5-5", "claude-haiku-5-5"],
  openai: ["gpt-4.1-mini", "gpt-4.1"],
  openrouter: ["anthropic/claude-sonnet-5.5", "openai/gpt-4.1-mini", "google/gemini-2.5-pro"],
};
const KEY_VARS: Record<Exclude<Provider, "sanity">, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

export type ModelOption = { id: string; provider: Provider; model: string; label: string };
const option = (provider: Provider, model: string): ModelOption => ({
  id: `${provider}:${model}`,
  provider,
  model,
  label: provider === "sanity" ? PROVIDERS.sanity.label : `${model} · ${PROVIDERS[provider].label.split(" ")[0]}`,
});

/**
 * The models this deployment offers, from the host's env:
 *   ANTHROPIC_API_KEY / OPENAI_API_KEY / OPENROUTER_API_KEY — one key per provider;
 *   AI_MODELS — optional allow-list "provider:model, …" (the agency caps cost here);
 *   AI_PROVIDER + AI_API_KEY (+ AI_MODEL) — the single-provider shorthand.
 * The first one is the default. Only models whose provider has a key are offered.
 */
export function availableModels(get: (name: string) => string | undefined): { options: ModelOption[]; keys: Partial<Record<Provider, string>> } {
  const legacy = (get("AI_PROVIDER") ?? "").trim() as Provider;
  const keys: Partial<Record<Provider, string>> = {};
  for (const [p, v] of Object.entries(KEY_VARS) as [Exclude<Provider, "sanity">, string][]) {
    const k = (get(v) ?? "").trim() || (legacy === p ? (get("AI_API_KEY") ?? "").trim() : "");
    if (k) keys[p] = k;
  }
  const usable = (p: Provider) => p === "sanity" || !!keys[p];
  const list = (get("AI_MODELS") ?? "").trim();
  let options: ModelOption[];
  if (list) {
    options = list
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean)
      .map((e) => {
        const i = e.indexOf(":");
        const p = (i < 0 ? e : e.slice(0, i)) as Provider;
        return p in PROVIDERS ? option(p, i < 0 ? PROVIDERS[p].model : e.slice(i + 1)) : null;
      })
      .filter((o): o is ModelOption => !!o && usable(o.provider));
  } else {
    options = (Object.keys(DEFAULT_MODELS) as Exclude<Provider, "sanity">[]).filter(usable).flatMap((p) => DEFAULT_MODELS[p].map((m) => option(p, m)));
    const preferred = (get("AI_MODEL") ?? "").trim();
    if (legacy in PROVIDERS && legacy !== "sanity" && preferred) options = [option(legacy, preferred), ...options.filter((o) => o.id !== `${legacy}:${preferred}`)];
    if (legacy === "sanity") options.push(option("sanity", ""));
  }
  return { options: options.filter((o, i, a) => a.findIndex((x) => x.id === o.id) === i), keys };
}

/** An image the model should see: base64 without the data: prefix. */
export type VisionImage = { mediaType: string; data: string };

/** The HTTP request for a provider (pure, so a check can assert its shape). */
export function buildRequest(cfg: ModelConfig, instruction: string, images: VisionImage[] = []): { url: string; init: RequestInit } {
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
        // No `temperature`: current Claude models reject it ("deprecated for this model").
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          messages: [
            {
              role: "user",
              content: images.length
                ? [...images.map((i) => ({ type: "image", source: { type: "base64", media_type: i.mediaType, data: i.data } })), { type: "text", text: instruction }]
                : instruction,
            },
          ],
        }),
      },
    };
  const url = cfg.provider === "openai" ? "https://api.openai.com/v1/chat/completions" : "https://openrouter.ai/api/v1/chat/completions";
  return {
    url,
    init: {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
      // No `temperature` either: newer OpenAI models only accept the default.
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: images.length
              ? [{ type: "text", text: instruction }, ...images.map((i) => ({ type: "image_url", image_url: { url: `data:${i.mediaType};base64,${i.data}` } }))]
              : instruction,
          },
        ],
      }),
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
export async function askModel(cfg: ModelConfig, instruction: string, images: VisionImage[] = []): Promise<string> {
  const { url, init } = buildRequest(cfg, instruction, images);
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (body as { error?: { message?: string } | string }).error;
    const text = typeof msg === "string" ? msg : msg?.message;
    throw Object.assign(new Error(`${PROVIDERS[cfg.provider].label}: ${text ?? res.statusText}`), { statusCode: res.status, provider: cfg.provider });
  }
  return readResponse(cfg.provider, body);
}
