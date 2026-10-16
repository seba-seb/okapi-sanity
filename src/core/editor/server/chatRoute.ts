/**
 * POST /api/editor-chat — the editor chat's server side (injected by
 * astro.config when the host can run it: dev, Vercel, Netlify, Cloudflare).
 *
 * The browser sends the request with the person's Sanity session token. This
 * route: checks the token with Sanity (who, which roles) → grant from
 * src/remarkable.policy.ts → reads the page from Sanity (not from the browser)
 * → asks the project's model with the key from the host's environment → returns
 * the proposed ops. The editor validates them again and saves them as a draft
 * with the person's own session. The AI key never reaches the browser.
 *
 * Host env vars: AI_PROVIDER (anthropic | openai | openrouter | sanity),
 * AI_API_KEY (not needed for "sanity"), AI_MODEL (optional).
 */
import type { APIRoute } from "astro";
import { getSecret } from "astro:env/server";
import { createClient } from "@sanity/client";

import { buildInstruction, parseAnswer, type Catalog, type ChatTurn } from "@/core/editor/chat";
import { grantFor, may } from "@/core/editor/policy";
import { dataset, projectId } from "@/core/sanity/env";
import { POLICY } from "@/remarkable.policy";
import { askModel, PROVIDERS, type Provider } from "./models";

export const prerender = false;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function modelConfig() {
  const provider = (getSecret("AI_PROVIDER") || "anthropic") as Provider;
  const apiKey = getSecret("AI_API_KEY") ?? "";
  const model = getSecret("AI_MODEL") ?? "";
  const known = provider in PROVIDERS;
  return { provider, apiKey, model, ready: known && (provider === "sanity" || !!apiKey), known };
}

// ponytail: per-instance memory, so it resets on cold starts and isn't shared
// across instances. The real ceiling is the spend limit on the provider account;
// move to a KV store if abuse shows up.
const recent = new Map<string, number[]>();
const PER_MINUTE = 20;
function limited(userId: string): boolean {
  const now = Date.now();
  const hits = (recent.get(userId) ?? []).filter((t) => now - t < 60_000);
  hits.push(now);
  recent.set(userId, hits);
  return hits.length > PER_MINUTE;
}

/** Status for the chat panel: is a model configured on this deployment? */
export const GET: APIRoute = () => {
  const cfg = modelConfig();
  return json({
    available: cfg.ready,
    provider: cfg.known ? PROVIDERS[cfg.provider].label : cfg.provider,
    model: cfg.model || (cfg.known ? PROVIDERS[cfg.provider].model : ""),
    reason: cfg.ready ? undefined : !cfg.known ? `Unknown AI_PROVIDER "${cfg.provider}"` : "AI_API_KEY is not set on this deployment",
  });
};

type Body = {
  documentId?: unknown;
  request?: unknown;
  selection?: unknown;
  history?: unknown;
  catalog?: unknown;
  viewAs?: unknown;
};

export const POST: APIRoute = async ({ request }) => {
  const cfg = modelConfig();
  if (!cfg.ready) return json({ error: "The chat isn't configured on this deployment (AI_PROVIDER / AI_API_KEY)." }, 503);

  // 1. Who is asking: the Sanity session token, checked with Sanity.
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Sign in to the Studio again." }, 401);
  const meRes = await fetch(`https://${projectId}.api.sanity.io/v2021-06-07/users/me`, { headers: { authorization: `Bearer ${token}` } });
  const me = (await meRes.json().catch(() => null)) as { id?: string; role?: string; roles?: { name: string }[] } | null;
  if (!meRes.ok || !me?.id) return json({ error: "Your Sanity session expired. Reload the Studio and sign in again." }, 401);
  if (limited(me.id)) return json({ error: "Too many requests — wait a minute." }, 429);
  const roles = me.roles?.map((r) => r.name) ?? (me.role ? [me.role] : []);

  // 2. What they may do. Admins may preview another role ("View as").
  const body = (await request.json().catch(() => ({}))) as Body;
  const viewAs = typeof body.viewAs === "string" && roles.includes("administrator") && POLICY[body.viewAs] ? body.viewAs : null;
  const grant = grantFor(viewAs ? [viewAs] : roles, POLICY);
  if (!may(grant, "chat")) return json({ error: "Your role can't use the chat." }, 403);

  // 3. The input, bounded.
  const documentId = typeof body.documentId === "string" ? body.documentId : "";
  const text = typeof body.request === "string" ? body.request.trim().slice(0, 4000) : "";
  if (!documentId || !text) return json({ error: "Missing page or message." }, 400);
  const selection = Array.isArray(body.selection) ? body.selection.filter((s): s is string => typeof s === "string").slice(0, 20) : [];
  const history = (Array.isArray(body.history) ? body.history : [])
    .filter((t): t is ChatTurn => !!t && (t.role === "user" || t.role === "assistant") && typeof t.text === "string")
    .slice(-8)
    .map((t) => ({ role: t.role, text: t.text.slice(0, 2000) }));
  // The field catalog comes from the Studio's compiled schema (the server has no Studio).
  // It only describes field types; the person's role on Sanity still bounds what they can write.
  const catalog = (body.catalog && typeof body.catalog === "object" ? body.catalog : {}) as Catalog;

  // 4. The page, read from Sanity with the person's own session (their read access applies).
  const sanity = createClient({ projectId, dataset, apiVersion: "2025-02-19", token, useCdn: false, perspective: "drafts" });
  const [doc, pages] = await Promise.all([
    sanity.fetch(`*[_id == $id][0]`, { id: documentId.replace(/^drafts\./, "") }),
    sanity.fetch<{ id: string; slug?: string; title?: string }[]>(`*[_type == "page" && defined(slug.current)]{ "id": _id, "slug": slug.current, title }`),
  ]);
  if (!doc) return json({ error: "Page not found." }, 404);

  // 5. Ask the model.
  const instruction = buildInstruction({ doc, catalog, grant, selection, pages, history, request: text });
  try {
    const raw =
      cfg.provider === "sanity"
        ? await sanity.withConfig({ apiVersion: "vX" }).agent.action.prompt({ instruction, format: "json", temperature: 0.2 })
        : await askModel(cfg, instruction);
    return json(parseAnswer(raw));
  } catch (e) {
    const err = e as { statusCode?: number; message?: string };
    // Don't echo provider auth details to the browser: that's the agency's key.
    if (err.statusCode === 401 || err.statusCode === 403) return json({ error: "The AI provider rejected this deployment's key. The agency must check AI_API_KEY." }, 502);
    if (err.statusCode === 429) return json({ error: "The AI provider's rate or spend limit was reached. Try again later." }, 502);
    return json({ error: `The AI request failed: ${err.message ?? "unknown error"}` }, 502);
  }
};
