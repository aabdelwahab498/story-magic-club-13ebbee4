// export-story-txt — Production TXT export inside the app (no external workflows).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BUCKET = "story-exports";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;
const MAX_TEXT_CHARS = 20_000;

interface ExportTxtRequest {
  story_id?: string | null;
  child_id?: string | null;
  title: string;
  full_text: string;
  language: string;
  child_name?: string | null;
  emotion_tags?: string[];
  page_count?: number | null;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function friendly(code: string, status = 400, extra: Record<string, unknown> = {}) {
  return json({ success: false, error: code, ...extra }, status);
}

function safeSlug(input: string, fallback = "story") {
  const cleaned = (input || "")
    .replace(/[^\p{L}\p{N}\-_ ]+/gu, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return cleaned || fallback;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return friendly("method_not_allowed", 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return friendly("unauthorized", 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return friendly("unauthorized", 401);
  const userId = userData.user.id;

  let payload: ExportTxtRequest;
  try { payload = (await req.json()) as ExportTxtRequest; }
  catch { return friendly("invalid_json", 400); }

  if (!payload?.full_text || typeof payload.full_text !== "string") return friendly("full_text_required", 400);
  if (payload.full_text.length > MAX_TEXT_CHARS) return friendly("text_too_long", 400, { max_chars: MAX_TEXT_CHARS });
  if (!payload.title || typeof payload.title !== "string") return friendly("title_required", 400);

  const language = (payload.language || "en").toLowerCase().slice(0, 10);
  const rl = await checkRateLimit(`u:${userId}`, "export-story-txt", { windowSec: 3600, max: 20, blockSec: 300 });
  if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: exportRow, error: insertErr } = await admin.from("exports").insert({
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
  }).select("id").single();

  if (insertErr || !exportRow) {
    console.error("[export-story-txt] db insert failed", insertErr);
    return friendly("db_insert_failed", 500);
  }

  const exportId = exportRow.id as string;
  const header = [
    payload.title,
    payload.child_name ? `— ${payload.child_name}` : null,
    `Language: ${language}`,
    "",
    "",
  ].filter(Boolean).join("\n");
  const bodyText = `\uFEFF${header}${payload.full_text}\n`;
  const bytes = new TextEncoder().encode(bodyText);
  const filename = `${safeSlug(payload.title)}.txt`;
  const objectPath = `${userId}/${exportId}.txt`;
  const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString();

  const upload = await admin.storage.from(BUCKET).upload(objectPath, bytes, {
    contentType: "text/plain; charset=utf-8",
    upsert: true,
  });
  if (upload.error) {
    await admin.from("exports").update({ status: "failed", error_message: upload.error.message }).eq("id", exportId);
    return friendly("storage_upload_failed", 500);
  }

  const signed = await admin.storage.from(BUCKET).createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS, { download: filename });
  if (signed.error || !signed.data?.signedUrl) {
    await admin.from("exports").update({ status: "failed", error_message: signed.error?.message ?? "sign_failed" }).eq("id", exportId);
    return friendly("sign_url_failed", 500);
  }

  await admin.from("exports").update({
    status: "ready",
    file_path: objectPath,
    signed_url: signed.data.signedUrl,
    file_size: bytes.byteLength,
    provider: "local",
    expires_at: expiresAt,
  }).eq("id", exportId);

  await admin.from("export_logs").insert({
    export_id: exportId,
    user_id: userId,
    action: "generated",
    details: { provider: "local", bytes: bytes.byteLength },
  });

  return json({
    success: true,
    export_id: exportId,
    download_url: signed.data.signedUrl,
    file_name: filename,
    file_size: bytes.byteLength,
    expires_at: expiresAt,
    dap_score: null,
    provider: "local",
  });
});