// n8n-export-pdf — Fully in-app PDF export (no external workflows).
// Renders a simple picture-book PDF from the request payload with pdf-lib
// and returns a signed URL to `story-pdfs`. Illustrations are embedded when
// available and small enough (PNG or JPEG); otherwise the page is text-only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PDF_BUCKET = "story-pdfs";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;
const MAX_PAGES = 30;
const MAX_IMAGES = 4;

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
  emotion_tags?: string[];
}

function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function friendly(code: string, status = 400, extra: Record<string, unknown> = {}) {
  return json({ success: false, error: code, ...extra }, status);
}
function slug(s: string, fb = "story") {
  const c = (s || "").replace(/[^\p{L}\p{N}\-_ ]+/gu, "").replace(/\s+/g, "-").slice(0, 60);
  return c || fb;
}

function wrap(text: string, font: unknown, size: number, maxWidth: number): string[] {
  const f = font as { widthOfTextAtSize: (t: string, s: number) => number };
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const tentative = line ? `${line} ${w}` : w;
    if (f.widthOfTextAtSize(tentative, size) > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = tentative;
    }
  }
  if (line) lines.push(line);
  return lines;
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
  try { payload = (await req.json()) as ExportPdfRequest; }
  catch { return friendly("invalid_json", 400); }
  if (!payload?.title) return friendly("title_required", 400);
  if (!Array.isArray(payload.pages) || payload.pages.length === 0) return friendly("pages_required", 400);
  if (payload.pages.length > MAX_PAGES) return friendly("too_many_pages", 400, { max_pages: MAX_PAGES });

  const rl = await checkRateLimit(`u:${userId}`, "export-pdf", { windowSec: 3600, max: 5, blockSec: 600 });
  if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const { data: exportRow, error: insErr } = await admin.from("exports").insert({
    user_id: userId, story_id: payload.story_id ?? null, child_id: payload.child_id ?? null,
    type: "pdf", language: (payload.language || "en").toLowerCase(),
    status: "generating",
    metadata: { title: payload.title, child_name: payload.child_name, emotion_tags: payload.emotion_tags },
    pdf_metadata: { page_count: payload.pages.length, theme_color: payload.theme_color },
  }).select("id").single();
  if (insErr || !exportRow) return friendly("db_insert_failed", 500);
  const exportId = exportRow.id as string;

  try {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const pageW = 595, pageH = 842, margin = 50, textSize = 14;

    // Cover
    const cover = doc.addPage([pageW, pageH]);
    cover.drawRectangle({ x: 0, y: 0, width: pageW, height: pageH, color: rgb(0.06, 0.1, 0.25) });
    const titleLines = wrap(payload.title, bold, 28, pageW - margin * 2);
    let y = pageH - 200;
    for (const line of titleLines) {
      cover.drawText(line, { x: margin, y, size: 28, font: bold, color: rgb(1, 0.95, 0.7) });
      y -= 40;
    }
    if (payload.child_name) {
      cover.drawText(`for ${payload.child_name}`, { x: margin, y: y - 20, size: 18, font, color: rgb(1, 1, 1) });
    }

    let embedded = 0;
    for (const p of payload.pages) {
      const page = doc.addPage([pageW, pageH]);
      let cursorY = pageH - margin;

      // Optional illustration (cap to avoid CPU/memory spikes)
      if (p.illustration_url && embedded < MAX_IMAGES) {
        try {
          const imgRes = await fetch(p.illustration_url);
          if (imgRes.ok) {
            const buf = new Uint8Array(await imgRes.arrayBuffer());
            const ct = imgRes.headers.get("content-type") ?? "";
            const img = ct.includes("png") ? await doc.embedPng(buf) : await doc.embedJpg(buf);
            const maxImgW = pageW - margin * 2;
            const scale = Math.min(maxImgW / img.width, 300 / img.height);
            const w = img.width * scale, h = img.height * scale;
            page.drawImage(img, { x: (pageW - w) / 2, y: cursorY - h, width: w, height: h });
            cursorY -= h + 20;
            embedded++;
          }
        } catch (e) {
          console.warn("[pdf] image embed skipped", e);
        }
      }

      page.drawText(`Page ${p.page_number}`, { x: margin, y: cursorY, size: 10, font, color: rgb(0.4, 0.4, 0.5) });
      cursorY -= 20;

      const lines = wrap(p.text || "", font, textSize, pageW - margin * 2);
      for (const line of lines) {
        if (cursorY < margin) break;
        page.drawText(line, { x: margin, y: cursorY, size: textSize, font, color: rgb(0.1, 0.1, 0.15) });
        cursorY -= textSize + 6;
      }
    }

    const pdfBytes = await doc.save();
    const filename = `${slug(payload.title)}.pdf`;
    const objectPath = `${userId}/${exportId}.pdf`;
    const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString();

    const up = await admin.storage.from(PDF_BUCKET).upload(objectPath, pdfBytes, {
      contentType: "application/pdf", upsert: true,
    });
    if (up.error) {
      await admin.from("exports").update({ status: "failed", error_message: up.error.message }).eq("id", exportId);
      return friendly("storage_upload_failed", 500);
    }
    const signed = await admin.storage.from(PDF_BUCKET).createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS, { download: filename });
    if (!signed.data?.signedUrl) return friendly("sign_url_failed", 500);

    await admin.from("exports").update({
      status: "ready", file_path: objectPath, signed_url: signed.data.signedUrl,
      file_size: pdfBytes.byteLength, provider: "local", expires_at: expiresAt,
      pdf_metadata: { page_count: payload.pages.length, theme_color: payload.theme_color },
    }).eq("id", exportId);
    await admin.from("export_logs").insert({
      export_id: exportId, user_id: userId, action: "generated",
      details: { provider: "local", bytes: pdfBytes.byteLength, page_count: payload.pages.length },
    });

    return json({
      success: true, export_id: exportId, download_url: signed.data.signedUrl,
      preview_url: null, file_name: filename, file_size: pdfBytes.byteLength,
      page_count: payload.pages.length, provider: "local", expires_at: expiresAt,
    });
  } catch (err) {
    console.error("[n8n-export-pdf] render failed", err);
    await admin.from("exports").update({
      status: "failed", error_message: (err as Error).message.slice(0, 500),
    }).eq("id", exportId);
    return friendly("pdf_render_failed", 500, { message: (err as Error).message });
  }
});
