// ============================================================================
// n8n-story-generate
// ----------------------------------------------------------------------------
// Public proxy for the "Generate Story" flow. Reads the story webhook URL +
// shared secret from `n8n_integration_settings` / `n8n_integration_secrets`
// and calls the configured n8n webhook with the `X-Webhook-Secret` header.
//
// Behaviour:
//   • If n8n is DISABLED or NOT CONFIGURED → returns { fallback: true, reason }.
//   • If the webhook errors, times out, or secret verification fails
//     (HTTP 401/403 from n8n)                → returns { fallback: true, reason }.
//   • If the webhook succeeds AND returns a JSON body containing a `title` and
//     a `pages` array                        → returns { fallback: false, story }.
//
// The frontend uses `fallback: true` as a signal to run the built-in
// `compose-story` pipeline instead — so the user never sees a hard failure.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET_KEY = "webhook_secret";
const N8N_TIMEOUT_MS = 55_000;

interface IncomingBody {
  idea?: string;
  child_id?: string | null;
  child_name?: string | null;
  language?: string;
  age_group?: string;
  user_id?: string | null;
}

Deno.serve(async (req) => {
  const cors = buildCorsHeaders(req);
  const pre = handlePreflight(req);
  if (pre) return pre;

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ fallback: true, reason: "method_not_allowed" }, 200);

  let body: IncomingBody = {};
  try {
    body = await req.json();
  } catch {
    return json({ fallback: true, reason: "invalid_json" }, 200);
  }
  if (!body.idea || typeof body.idea !== "string" || body.idea.trim().length < 3) {
    return json({ fallback: true, reason: "idea_missing" }, 200);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // Load settings
  const { data: settings } = await admin
    .from("n8n_integration_settings")
    .select("story_webhook_url, story_enabled")
    .limit(1)
    .maybeSingle();

  if (!settings || !settings.story_enabled) {
    return json({ fallback: true, reason: "story_webhook_disabled" });
  }
  const url = (settings.story_webhook_url as string | null) ?? "";
  if (!url) {
    return json({ fallback: true, reason: "story_webhook_url_missing" });
  }

  // Load shared secret (optional — n8n workflow may not require it)
  const { data: secretRow } = await admin
    .from("n8n_integration_secrets")
    .select("value")
    .eq("key", SECRET_KEY)
    .maybeSingle();
  const secret = (secretRow?.value as string | undefined) ?? "";

  // Call the n8n webhook
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), N8N_TIMEOUT_MS);
  const startedAt = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "Content-Type": "application/json",
        // Always send the shared secret so n8n can gate access. If the header
        // is wrong, n8n returns 401/403 and the frontend transparently falls
        // back to the local pipeline.
        ...(secret ? { "X-Webhook-Secret": secret } : {}),
      },
      body: JSON.stringify({
        idea: body.idea.trim(),
        child_id: body.child_id ?? null,
        child_name: body.child_name ?? null,
        language: body.language ?? "en",
        age_group: body.age_group ?? null,
        user_id: body.user_id ?? null,
        source: "starry-tales",
        ts: Date.now(),
      }),
    });
    const elapsedMs = Date.now() - startedAt;

    if (res.status === 401 || res.status === 403) {
      return json({
        fallback: true,
        reason: "secret_rejected",
        http_status: res.status,
        message: `n8n rejected the webhook secret (HTTP ${res.status}). Local generator will be used.`,
        elapsed_ms: elapsedMs,
      });
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return json({
        fallback: true,
        reason: "http_error",
        http_status: res.status,
        message: `HTTP ${res.status} ${text.slice(0, 200)}`,
        elapsed_ms: elapsedMs,
      });
    }

    // Parse response
    let payload: Record<string, unknown> = {};
    try {
      payload = await res.json();
    } catch {
      return json({
        fallback: true,
        reason: "invalid_response",
        http_status: res.status,
        message: "n8n returned non-JSON",
        elapsed_ms: elapsedMs,
      });
    }

    // n8n Chat Trigger commonly wraps output. Accept several shapes.
    const raw = (payload as { output?: unknown }).output ?? payload;
    const story = normalizeStory(raw);
    if (!story) {
      return json({
        fallback: true,
        reason: "invalid_story_shape",
        http_status: res.status,
        message: "Missing title or pages[] in n8n response",
        elapsed_ms: elapsedMs,
        received: payload,
      });
    }

    return json({
      fallback: false,
      provider: "n8n",
      http_status: res.status,
      elapsed_ms: elapsedMs,
      story,
    });
  } catch (err) {
    const elapsedMs = Date.now() - startedAt;
    const msg = (err as Error).message || "network_error";
    const aborted = ctrl.signal.aborted;
    return json({
      fallback: true,
      reason: aborted ? "timeout" : "network_error",
      message: aborted ? `Timed out after ${N8N_TIMEOUT_MS}ms` : msg,
      elapsed_ms: elapsedMs,
    });
  } finally {
    clearTimeout(timer);
  }
});

// ── Normalise n8n's response into the shape the SEL viewer expects ──────────
function normalizeStory(raw: unknown): {
  title: string;
  language: string;
  pages: { index: number; text: string; illustrationPrompt: string; emotionTag: string }[];
  provider: string;
} | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const title =
    (typeof r.title === "string" && r.title.trim()) ||
    (typeof r.story_title === "string" && r.story_title.trim()) ||
    "";
  const pagesRaw =
    (Array.isArray(r.pages) && r.pages) ||
    (Array.isArray(r.scenes) && r.scenes) ||
    (Array.isArray((r.story as { pages?: unknown[] } | undefined)?.pages) && (r.story as { pages: unknown[] }).pages) ||
    null;
  if (!title || !pagesRaw || pagesRaw.length === 0) return null;

  const pages = (pagesRaw as unknown[]).map((p, i) => {
    const o = (p as Record<string, unknown>) ?? {};
    const text =
      (typeof o.text === "string" && o.text) ||
      (typeof o.content === "string" && o.content) ||
      (typeof o.body === "string" && o.body) ||
      "";
    const illustrationPrompt =
      (typeof o.illustration_prompt === "string" && o.illustration_prompt) ||
      (typeof o.illustrationPrompt === "string" && o.illustrationPrompt) ||
      (typeof o.image_prompt === "string" && o.image_prompt) ||
      "";
    const emotionTag =
      (typeof o.emotion_tag === "string" && o.emotion_tag) ||
      (typeof o.emotionTag === "string" && o.emotionTag) ||
      "joy";
    return {
      index: typeof o.index === "number" ? o.index : i + 1,
      text: String(text),
      illustrationPrompt: String(illustrationPrompt),
      emotionTag: String(emotionTag),
    };
  }).filter((p) => p.text.trim().length > 0);

  if (pages.length === 0) return null;

  return {
    title,
    language: (typeof r.language === "string" && r.language) || "en",
    pages,
    provider: (typeof r.provider === "string" && r.provider) || "n8n",
  };
}
