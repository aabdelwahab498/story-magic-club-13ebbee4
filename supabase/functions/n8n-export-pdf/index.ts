// ============================================================================
// n8n-export-pdf  —  Picture-book PDF proxy to the n8n PDF workflow
// ----------------------------------------------------------------------------
// Flow:
//   1. Auth + rate-limit (5/hour/user, 180s SLA)
//   2. POST payload to n8n `/export-pdf` webhook (expects { pdf_base64, page_count?, preview_base64? })
//   3. If n8n unavailable/fails ⇒ fall back to existing `export-story-pdf`
//      Lovable edge function via functions.invoke() (server-to-server, keeps
//      the caller's JWT).
//   4. Upload PDF to `story-pdfs` bucket, upload thumbnail (if provided) to
//      `story-images/previews/`, record exports + export_logs.
//   5. Return { download_url (signed 24h), preview_url, page_count, file_size }.
// ============================================================================

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
import { getN8nConfig } from "../_shared/n8nConfig.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PDF_BUCKET = "story-pdfs";
const IMG_BUCKET = "story-images";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;
const N8N_TIMEOUT_MS = 180_000;
const MAX_PAGES = 30;

interface PageInput {
  page_number: number;
  text: string;
  illustration_url?: string | null;
  emotion_tag?: string | null;
}

interface ExportPdfRequest {
  story_id?: string | null;
  child_id?: string | null;
  title: string;
  pages: PageInput[];
  language: string;
  child_name?: string | null;
  theme_color?: string | null;
  font_family?: string | null;
  emotion_tags?: string[];
}

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function friendly(code: string, status = 400, extra: Record<string, unknown> = {}): Response {
  return json({ success: false, error: code, ...extra }, status);
}
function slug(s: string, fb = "story"): string {
  const c = (s || "").replace(/[^\p{L}\p{N}\-_ ]+/gu, "").replace(/\s+/g, "-").slice(0, 60);
  return c || fb;
}

type N8nPdfResult =
  | { kind: "url"; downloadUrl: string; previewUrl: string | null; pageCount: number | null; provider: string }
  | { kind: "bytes"; pdf: Uint8Array; preview: Uint8Array | null; pageCount: number | null; provider: string };

async function callN8n(payload: ExportPdfRequest, admin: SupabaseClient): Promise<
  { ok: true; result: N8nPdfResult } | { ok: false; status: number | null; message: string }
> {
  const cfg = await getN8nConfig(admin, "pdf");
  if (!cfg.url) return { ok: false, status: null, message: "n8n webhook not configured" };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), N8N_TIMEOUT_MS);
  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", "X-Webhook-Secret": cfg.secret },
      body: JSON.stringify(payload),
    });
    const ctype = res.headers.get("content-type") ?? "";
    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      return { ok: false, status: res.status, message: msg.slice(0, 300) || `n8n ${res.status}` };
    }
    // Raw PDF binary response
    if (ctype.includes("application/pdf")) {
      const pdf = new Uint8Array(await res.arrayBuffer());
      return { ok: true, result: { kind: "bytes", pdf, preview: null, pageCount: null, provider: "n8n" } };
    }
    // JSON response — URL or base64
    const data = (await res.json().catch(() => null)) as
      | {
          download_url?: string; file_url?: string; url?: string; pdf_url?: string;
          preview_url?: string;
          pdf_base64?: string; preview_base64?: string;
          page_count?: number; provider?: string;
        }
      | null;
    const url = data?.download_url || data?.file_url || data?.pdf_url || data?.url || null;
    if (url) {
      return {
        ok: true,
        result: {
          kind: "url", downloadUrl: url,
          previewUrl: data?.preview_url ?? null,
          pageCount: data?.page_count ?? null,
          provider: data?.provider ?? "n8n",
        },
      };
    }
    if (data?.pdf_base64) {
      const pdf = Uint8Array.from(atob(data.pdf_base64), (c) => c.charCodeAt(0));
      const preview = data.preview_base64
        ? Uint8Array.from(atob(data.preview_base64), (c) => c.charCodeAt(0))
        : null;
      return { ok: true, result: { kind: "bytes", pdf, preview, pageCount: data.page_count ?? null, provider: data.provider ?? "n8n" } };
    }
    return { ok: false, status: res.status, message: "n8n response missing pdf url or data" };
  } catch (err) {
    return { ok: false, status: null, message: (err as Error).message };
  } finally {
    clearTimeout(t);
  }
}

// Local fallback removed — n8n is the sole export provider.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return friendly("method_not_allowed", 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return friendly("unauthorized", 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: uData, error: uErr } = await userClient.auth.getUser();
  if (uErr || !uData?.user) return friendly("unauthorized", 401);
  const userId = uData.user.id;

  let payload: ExportPdfRequest;
  try {
    payload = (await req.json()) as ExportPdfRequest;
  } catch {
    return friendly("invalid_json", 400);
  }
  if (!payload?.title) return friendly("title_required", 400);
  if (!Array.isArray(payload.pages) || payload.pages.length === 0) {
    return friendly("pages_required", 400);
  }
  if (payload.pages.length > MAX_PAGES) return friendly("too_many_pages", 400, { max_pages: MAX_PAGES });

  const rl = await checkRateLimit(`u:${userId}`, "export-pdf", { windowSec: 3600, max: 5, blockSec: 600 });
  if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // Insert generating row + requested log
  const { data: exportRow, error: insErr } = await admin.from("exports").insert({
    user_id: userId,
    story_id: payload.story_id ?? null,
    child_id: payload.child_id ?? null,
    type: "pdf",
    language: (payload.language || "en").toLowerCase(),
    status: "generating",
    metadata: { title: payload.title, child_name: payload.child_name, emotion_tags: payload.emotion_tags },
    pdf_metadata: { page_count: payload.pages.length, theme_color: payload.theme_color },
  }).select("id").single();
  if (insErr || !exportRow) return friendly("db_insert_failed", 500);
  const exportId = exportRow.id as string;

  await admin.from("export_logs").insert({
    export_id: exportId, user_id: userId, action: "requested",
    details: { pages: payload.pages.length, language: payload.language },
  });

  const filename = `${slug(payload.title)}.pdf`;
  const objectPath = `${userId}/${exportId}.pdf`;
  const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString();

  const n8nRes = await callN8n(payload, admin);
  if (!n8nRes.ok) {
    await admin.from("exports").update({
      status: "failed",
      error_message: `n8n ${n8nRes.status ?? ""}: ${n8nRes.message}`.slice(0, 500),
    }).eq("id", exportId);
    await admin.from("export_logs").insert({
      export_id: exportId, user_id: userId, action: "failed",
      details: { stage: "n8n", status: n8nRes.status, message: n8nRes.message },
    });
    return friendly("pdf_pipeline_failed", 502, { status: n8nRes.status, message: n8nRes.message });
  }
  const result = n8nRes.result;

  // Direct URL from n8n — pass through, no re-upload.
  if (result.kind === "url") {
    await admin.from("exports").update({
      status: "ready", signed_url: result.downloadUrl,
      provider: result.provider, expires_at: expiresAt,
      pdf_metadata: { page_count: result.pageCount ?? payload.pages.length, preview_url: result.previewUrl, theme_color: payload.theme_color, remote: true },
    }).eq("id", exportId);
    await admin.from("export_logs").insert({
      export_id: exportId, user_id: userId, action: "generated",
      details: { provider: result.provider, remote_url: true, page_count: result.pageCount },
    });
    return json({
      success: true, export_id: exportId, download_url: result.downloadUrl,
      preview_url: result.previewUrl, file_name: filename, file_size: null,
      page_count: result.pageCount ?? payload.pages.length, provider: result.provider, expires_at: expiresAt,
    });
  }

  // Binary/base64 PDF — upload to storage and sign.
  const up = await admin.storage.from(PDF_BUCKET).upload(objectPath, result.pdf, {
    contentType: "application/pdf", upsert: true,
  });
  if (up.error) {
    await admin.from("exports").update({ status: "failed", error_message: up.error.message }).eq("id", exportId);
    return friendly("storage_upload_failed", 500);
  }
  let previewUrl: string | null = null;
  if (result.preview) {
    const previewPath = `previews/${userId}/${exportId}.png`;
    const pv = await admin.storage.from(IMG_BUCKET).upload(previewPath, result.preview, {
      contentType: "image/png", upsert: true,
    });
    if (!pv.error) {
      const pvSigned = await admin.storage.from(IMG_BUCKET)
        .createSignedUrl(previewPath, SIGNED_URL_TTL_SECONDS);
      previewUrl = pvSigned.data?.signedUrl ?? null;
    }
  }
  const signed = await admin.storage.from(PDF_BUCKET)
    .createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS, { download: filename });
  if (!signed.data?.signedUrl) return friendly("sign_url_failed", 500);

  await admin.from("exports").update({
    status: "ready", file_path: objectPath, signed_url: signed.data.signedUrl,
    file_size: result.pdf.byteLength, provider: result.provider, expires_at: expiresAt,
    pdf_metadata: { page_count: result.pageCount ?? payload.pages.length, preview_url: previewUrl, theme_color: payload.theme_color },
  }).eq("id", exportId);
  await admin.from("export_logs").insert({
    export_id: exportId, user_id: userId, action: "generated",
    details: { provider: result.provider, bytes: result.pdf.byteLength, page_count: result.pageCount },
  });
  return json({
    success: true, export_id: exportId, download_url: signed.data.signedUrl,
    preview_url: previewUrl, file_name: filename, file_size: result.pdf.byteLength,
    page_count: result.pageCount ?? payload.pages.length, provider: result.provider, expires_at: expiresAt,
  });
});
