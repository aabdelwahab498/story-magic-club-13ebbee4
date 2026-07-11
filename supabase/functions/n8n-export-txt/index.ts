// ============================================================================
// n8n-export-txt
// ----------------------------------------------------------------------------
// Secure proxy between the Starry Tales client and the n8n TXT-export workflow.
//
// Responsibilities:
//   1. Validate the caller's JWT (Supabase auth).
//   2. Rate-limit to 5 exports/hour/user (shared with future MP3/PDT flows via
//      distinct endpoint keys).
//   3. Record the export request in the `exports` and `export_logs` tables.
//   4. Forward the payload to the configured n8n webhook (or fall back to a
//      local BOM-safe UTF-8 renderer when n8n is not yet configured).
//   5. Upload the resulting TXT to the `story-exports` bucket, mint a 24-hour
//      signed URL and return it to the caller.
//
// The edge function is deliberately provider-agnostic: swapping the n8n
// endpoint for a different automation platform requires no client changes.
// ============================================================================

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
import { getN8nConfig } from "../_shared/n8nConfig.ts";

// ────────────────────────────────────────────────────────────────────────────
// Config
// ────────────────────────────────────────────────────────────────────────────
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BUCKET = "story-exports";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24; // 24h
const N8N_TIMEOUT_MS = 60_000; // TXT flow SLA
const MAX_TEXT_CHARS = 10_000;

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────
interface ExportTxtRequest {
  story_id?: string | null;
  child_id?: string | null;
  title: string;
  full_text: string;
  language: string;
  child_name?: string | null;
  emotion_tags?: string[];
  page_count?: number;
}

interface ExportTxtResponse {
  success: true;
  export_id: string;
  download_url: string;
  file_name: string;
  file_size: number | null;
  expires_at: string;
  dap_score?: number | null;
  provider: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/** Return a Response with JSON + CORS. */
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Kid-friendly error payload (localized on the client). */
function friendly(code: string, status = 400, extra: Record<string, unknown> = {}): Response {
  return json({ success: false, error: code, ...extra }, status);
}

/** Build a filesystem-safe filename slug (keeps Arabic letters, drops punctuation). */
function safeSlug(input: string, fallback = "story"): string {
  const cleaned = (input || "")
    .replace(/[^\p{L}\p{N}\-_ ]+/gu, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return cleaned || fallback;
}

type N8nTxtResult =
  | { kind: "url"; downloadUrl: string; dapScore: number | null; provider: string }
  | { kind: "text"; text: string; dapScore: number | null; provider: string };

/**
 * Call the n8n TXT workflow. Accepts either a downloadable file URL or
 * inline text/base64 in the response. No local fallback.
 */
async function callN8n(payload: ExportTxtRequest, admin: SupabaseClient): Promise<
  { ok: true; result: N8nTxtResult } | { ok: false; status: number | null; message: string }
> {
  const cfg = await getN8nConfig(admin, "txt");
  if (!cfg.url) return { ok: false, status: null, message: "n8n webhook not configured" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS);
  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Secret": cfg.secret,
      },
      body: JSON.stringify(payload),
    });
    const ctype = res.headers.get("content-type") ?? "";
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      return { ok: false, status: res.status, message: msg.slice(0, 300) || `n8n ${res.status}` };
    }
    if (ctype.startsWith("text/plain")) {
      const text = await res.text();
      return { ok: true, result: { kind: "text", text, dapScore: null, provider: "n8n" } };
    }
    const data = (await res.json().catch(() => null)) as
      | { download_url?: string; file_url?: string; url?: string;
          file_content_base64?: string; text_content?: string; dap_score?: number; provider?: string }
      | null;
    const url = data?.download_url || data?.file_url || data?.url || null;
    if (url) {
      return { ok: true, result: { kind: "url", downloadUrl: url, dapScore: data?.dap_score ?? null, provider: data?.provider ?? "n8n" } };
    }
    const raw = data?.file_content_base64
      ? new TextDecoder().decode(Uint8Array.from(atob(data.file_content_base64), (c) => c.charCodeAt(0)))
      : data?.text_content;
    if (raw) return { ok: true, result: { kind: "text", text: raw, dapScore: data?.dap_score ?? null, provider: data?.provider ?? "n8n" } };
    return { ok: false, status: res.status, message: "n8n response missing text or url" };
  } catch (err) {
    return { ok: false, status: null, message: (err as Error).message };
  } finally {
    clearTimeout(timer);
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Entrypoint
// ────────────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return friendly("method_not_allowed", 405);

  // ── 1. Auth ────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return friendly("unauthorized", 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return friendly("unauthorized", 401);
  const userId = userData.user.id;

  // ── 2. Validate body ───────────────────────────────────────────────────
  let payload: ExportTxtRequest;
  try {
    payload = (await req.json()) as ExportTxtRequest;
  } catch {
    return friendly("invalid_json", 400);
  }
  if (!payload?.full_text || typeof payload.full_text !== "string") {
    return friendly("full_text_required", 400);
  }
  if (payload.full_text.length > MAX_TEXT_CHARS) {
    return friendly("text_too_long", 400, { max_chars: MAX_TEXT_CHARS });
  }
  if (!payload.title || typeof payload.title !== "string") {
    return friendly("title_required", 400);
  }
  const language = (payload.language || "en").toLowerCase();
  if (!/^[a-z]{2}(-[a-z]{2,})?$/i.test(language)) {
    return friendly("invalid_language", 400);
  }

  // ── 3. Rate limit — 5/hour/user for TXT exports ───────────────────────
  const rl = await checkRateLimit(`u:${userId}`, "export-txt", {
    windowSec: 3600,
    max: 5,
    blockSec: 600,
  });
  if (!rl.allowed) {
    return rateLimitResponse(rl, corsHeaders);
  }

  // ── 4. Service-role client for DB + storage writes ────────────────────
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // ── 5. Create the export row ───────────────────────────────────────────
  const { data: exportRow, error: insertErr } = await admin
    .from("exports")
    .insert({
      user_id: userId,
      story_id: payload.story_id ?? null,
      child_id: payload.child_id ?? null,
      type: "txt",
      language,
      status: "generating",
      metadata: {
        title: payload.title,
        child_name: payload.child_name ?? null,
        emotion_tags: payload.emotion_tags ?? [],
        page_count: payload.page_count ?? null,
      },
    })
    .select("id")
    .single();

  if (insertErr || !exportRow) {
    console.error("[n8n-export-txt] insert exports failed:", insertErr);
    return friendly("db_insert_failed", 500);
  }
  const exportId = exportRow.id as string;

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || null;
  const ua = req.headers.get("user-agent") ?? null;
  await admin.from("export_logs").insert({
    export_id: exportId,
    user_id: userId,
    action: "requested",
    ip_address: ip,
    user_agent: ua,
    details: { language, chars: payload.full_text.length },
  });

  // ── 6. Call n8n (or fall back locally) ────────────────────────────────
  const { text, dapScore, provider } = await callN8n(payload, admin);
  const bytes = new TextEncoder().encode(text);
  const filename = `${safeSlug(payload.title)}.txt`;
  const objectPath = `${userId}/${exportId}.txt`;

  // ── 7. Upload to Storage ──────────────────────────────────────────────
  const upload = await admin.storage.from(BUCKET).upload(objectPath, bytes, {
    contentType: "text/plain; charset=utf-8",
    upsert: true,
  });
  if (upload.error) {
    console.error("[n8n-export-txt] upload failed:", upload.error);
    await admin.from("exports").update({
      status: "failed",
      error_message: upload.error.message,
    }).eq("id", exportId);
    await admin.from("export_logs").insert({
      export_id: exportId,
      user_id: userId,
      action: "failed",
      details: { stage: "upload", message: upload.error.message },
    });
    return friendly("storage_upload_failed", 500);
  }

  // ── 8. Signed URL (24h) ───────────────────────────────────────────────
  const signed = await admin.storage.from(BUCKET).createSignedUrl(
    objectPath,
    SIGNED_URL_TTL_SECONDS,
    { download: filename },
  );
  if (signed.error || !signed.data?.signedUrl) {
    console.error("[n8n-export-txt] signed url failed:", signed.error);
    await admin.from("exports").update({
      status: "failed",
      error_message: signed.error?.message ?? "sign_failed",
    }).eq("id", exportId);
    return friendly("sign_url_failed", 500);
  }

  const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString();

  await admin.from("exports").update({
    status: "ready",
    file_path: objectPath,
    signed_url: signed.data.signedUrl,
    file_size: bytes.byteLength,
    provider,
    dap_score: dapScore,
    expires_at: expiresAt,
  }).eq("id", exportId);

  await admin.from("export_logs").insert({
    export_id: exportId,
    user_id: userId,
    action: "generated",
    details: { provider, bytes: bytes.byteLength, dap_score: dapScore },
  });

  const response: ExportTxtResponse = {
    success: true,
    export_id: exportId,
    download_url: signed.data.signedUrl,
    file_name: filename,
    file_size: bytes.byteLength,
    expires_at: expiresAt,
    dap_score: dapScore,
    provider,
  };
  return json(response, 200);
});
