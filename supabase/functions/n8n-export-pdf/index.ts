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

async function callN8n(payload: ExportPdfRequest, admin: SupabaseClient): Promise<
  | { pdf: Uint8Array; preview: Uint8Array | null; pageCount: number | null; provider: string }
  | null
> {
  const cfg = await getN8nConfig(admin, "pdf");
  if (!cfg.url) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), N8N_TIMEOUT_MS);
  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", "X-Webhook-Secret": cfg.secret },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const data = (await res.json().catch(() => null)) as
      | { pdf_base64?: string; preview_base64?: string; page_count?: number; provider?: string }
      | null;
    if (!data?.pdf_base64) return null;
    const pdf = Uint8Array.from(atob(data.pdf_base64), (c) => c.charCodeAt(0));
    const preview = data.preview_base64
      ? Uint8Array.from(atob(data.preview_base64), (c) => c.charCodeAt(0))
      : null;
    return { pdf, preview, pageCount: data.page_count ?? null, provider: data.provider ?? "n8n" };
  } catch (err) {
    console.warn("[n8n-export-pdf] webhook failed:", (err as Error).message);
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Server-to-server fallback: call the existing `export-story-pdf` edge
 * function which already builds a full picture-book PDF and uploads it to
 * `story-pdfs`. We then re-sign a fresh 24h URL from the returned path.
 */
async function callFallback(
  authHeader: string,
  payload: ExportPdfRequest,
): Promise<{ pdfUrl: string; pageCount: number | null; provider: string } | null> {
  if (!payload.story_id) {
    console.warn("[n8n-export-pdf] fallback skipped: missing story_id");
    return null;
  }
  try {
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data, error } = await client.functions.invoke<{ pdfUrl?: string; error?: string }>(
      "export-story-pdf",
      {
        body: {
          storyId: payload.story_id,
          // Keep CPU usage under Edge limit — cap heavy PNG embedding.
          maxImages: 4,
        },
      },
    );
    if (error || !data?.pdfUrl) {
      console.warn("[n8n-export-pdf] fallback error:", error?.message || data?.error);
      return null;
    }
    return { pdfUrl: data.pdfUrl, pageCount: payload.pages.length, provider: "local-fallback" };
  } catch (err) {
    console.warn("[n8n-export-pdf] fallback failed:", (err as Error).message);
    return null;
  }
}

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

  // Try n8n first
  const n8n = await callN8n(payload, admin);
  if (n8n) {
    const up = await admin.storage.from(PDF_BUCKET).upload(objectPath, n8n.pdf, {
      contentType: "application/pdf", upsert: true,
    });
    if (up.error) {
      await admin.from("exports").update({ status: "failed", error_message: up.error.message }).eq("id", exportId);
      return friendly("storage_upload_failed", 500);
    }
    let previewUrl: string | null = null;
    if (n8n.preview) {
      const previewPath = `previews/${userId}/${exportId}.png`;
      const pv = await admin.storage.from(IMG_BUCKET).upload(previewPath, n8n.preview, {
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
      file_size: n8n.pdf.byteLength, provider: n8n.provider, expires_at: expiresAt,
      pdf_metadata: { page_count: n8n.pageCount ?? payload.pages.length, preview_url: previewUrl, theme_color: payload.theme_color },
    }).eq("id", exportId);
    await admin.from("export_logs").insert({
      export_id: exportId, user_id: userId, action: "generated",
      details: { provider: n8n.provider, bytes: n8n.pdf.byteLength, page_count: n8n.pageCount },
    });
    return json({
      success: true, export_id: exportId, download_url: signed.data.signedUrl,
      preview_url: previewUrl, file_name: filename, file_size: n8n.pdf.byteLength,
      page_count: n8n.pageCount ?? payload.pages.length, provider: n8n.provider, expires_at: expiresAt,
    });
  }

  // Fallback: existing edge PDF builder
  const fb = await callFallback(authHeader, payload);
  if (fb?.pdfUrl) {
    await admin.from("exports").update({
      status: "ready", file_path: fb.pdfUrl, signed_url: fb.pdfUrl,
      provider: fb.provider, expires_at: expiresAt,
      pdf_metadata: { page_count: fb.pageCount, theme_color: payload.theme_color, fallback: true },
    }).eq("id", exportId);
    await admin.from("export_logs").insert({
      export_id: exportId, user_id: userId, action: "generated",
      details: { provider: fb.provider, fallback: true, page_count: fb.pageCount },
    });
    return json({
      success: true, export_id: exportId, download_url: fb.pdfUrl,
      preview_url: null, file_name: filename, file_size: null,
      page_count: fb.pageCount, provider: fb.provider, expires_at: expiresAt,
    });
  }

  await admin.from("exports").update({ status: "failed", error_message: "pdf_pipeline_failed" }).eq("id", exportId);
  await admin.from("export_logs").insert({
    export_id: exportId, user_id: userId, action: "failed",
    details: { stage: "pdf" },
  });
  return friendly("pdf_pipeline_failed", 502);
});
