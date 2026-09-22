// export-story-pdf — Production PDF export for saved or client-supplied stories.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rateLimit.ts";
import { PDFDocument, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const PDF_BUCKET = "story-pdfs";
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24;
const MAX_PAGES = 30;
// One illustration per story page (canonical stories are 10-15 pages).
const MAX_IMAGES = 15;
const MAX_IMAGE_BYTES = 2_500_000;
// Total embedded image budget: keeps the export inside the function memory limit.
const MAX_TOTAL_IMAGE_BYTES = 6_000_000;
const ARABIC_FONT_URL = "https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansArabic/NotoSansArabic-Regular.ttf";
const ARABIC_FONT_BOLD_URL = "https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansArabic/NotoSansArabic-Bold.ttf";
const LATIN_FONT_URL = "https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf";
const LATIN_FONT_BOLD_URL = "https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf";

interface PageInput {
  page_number?: number;
  index?: number;
  text?: string;
  content?: string;
  narration?: string;
  illustration_url?: string | null;
  image_url?: string | null;
  imageUrl?: string | null;
  emotion_tag?: string | null;
  emotionTag?: string | null;
}

interface ExportPdfRequest {
  storyId?: string;
  story_id?: string | null;
  child_id?: string | null;
  title?: string;
  pages?: PageInput[];
  language?: string;
  child_name?: string | null;
  theme_color?: string | null;
  emotion_tags?: string[];
  force?: boolean;
  skipImages?: boolean;
  maxImages?: number;
}

interface NormalizedPage {
  pageNumber: number;
  text: string;
  imageUrl: string | null;
  emotionTag: string | null;
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

function slug(input: string, fallback = "story") {
  const cleaned = (input || "")
    .replace(/[^\p{L}\p{N}\-_ ]+/gu, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return cleaned || fallback;
}

function normalizeText(input: unknown): string {
  return String(input ?? "").replace(/\r\n/g, "\n").trim();
}

function hasArabic(text: string) {
  return /[\u0600-\u06FF]/.test(text);
}

const ARABIC_FORMS: Record<string, [string, string, string?, string?]> = {
  "ء": ["ﺀ", "ﺀ"], "آ": ["ﺁ", "ﺂ"], "أ": ["ﺃ", "ﺄ"], "ؤ": ["ﺅ", "ﺆ"], "إ": ["ﺇ", "ﺈ"], "ئ": ["ﺉ", "ﺊ", "ﺋ", "ﺌ"],
  "ا": ["ﺍ", "ﺎ"], "ب": ["ﺏ", "ﺐ", "ﺑ", "ﺒ"], "ة": ["ﺓ", "ﺔ"], "ت": ["ﺕ", "ﺖ", "ﺗ", "ﺘ"], "ث": ["ﺙ", "ﺚ", "ﺛ", "ﺜ"],
  "ج": ["ﺝ", "ﺞ", "ﺟ", "ﺠ"], "ح": ["ﺡ", "ﺢ", "ﺣ", "ﺤ"], "خ": ["ﺥ", "ﺦ", "ﺧ", "ﺨ"], "د": ["ﺩ", "ﺪ"], "ذ": ["ﺫ", "ﺬ"],
  "ر": ["ﺭ", "ﺮ"], "ز": ["ﺯ", "ﺰ"], "س": ["ﺱ", "ﺲ", "ﺳ", "ﺴ"], "ش": ["ﺵ", "ﺶ", "ﺷ", "ﺸ"], "ص": ["ﺹ", "ﺺ", "ﺻ", "ﺼ"],
  "ض": ["ﺽ", "ﺾ", "ﺿ", "ﻀ"], "ط": ["ﻁ", "ﻂ", "ﻃ", "ﻄ"], "ظ": ["ﻅ", "ﻆ", "ﻇ", "ﻈ"], "ع": ["ﻉ", "ﻊ", "ﻋ", "ﻌ"], "غ": ["ﻍ", "ﻎ", "ﻏ", "ﻐ"],
  "ف": ["ﻑ", "ﻒ", "ﻓ", "ﻔ"], "ق": ["ﻕ", "ﻖ", "ﻗ", "ﻘ"], "ك": ["ﻙ", "ﻚ", "ﻛ", "ﻜ"], "ل": ["ﻝ", "ﻞ", "ﻟ", "ﻠ"], "م": ["ﻡ", "ﻢ", "ﻣ", "ﻤ"],
  "ن": ["ﻥ", "ﻦ", "ﻧ", "ﻨ"], "ه": ["ﻩ", "ﻪ", "ﻫ", "ﻬ"], "و": ["ﻭ", "ﻮ"], "ى": ["ﻯ", "ﻰ"], "ي": ["ﻱ", "ﻲ", "ﻳ", "ﻴ"],
  "لا": ["ﻻ", "ﻼ"], "لآ": ["ﻵ", "ﻶ"], "لأ": ["ﻷ", "ﻸ"], "لإ": ["ﻹ", "ﻺ"],
};

function canJoinBefore(ch: string): boolean {
  const forms = ARABIC_FORMS[ch];
  return !!forms && !!forms[1];
}

function canJoinAfter(ch: string): boolean {
  const forms = ARABIC_FORMS[ch];
  return !!forms && !!forms[2];
}

function stripArabicMarks(text: string): string {
  return text.replace(/[\u064B-\u065F\u0670]/g, "");
}

function shapeArabicRun(run: string): string {
  const chars = Array.from(stripArabicMarks(run));
  const shaped: string[] = [];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const next = chars[i + 1];
    if (ch === "ل" && next && ["ا", "أ", "إ", "آ"].includes(next)) {
      const prev = chars[i - 1];
      const joinsPrev = !!prev && canJoinAfter(prev);
      const ligatureKey = `ل${next}`;
      const forms = ARABIC_FORMS[ligatureKey] ?? ARABIC_FORMS["لا"];
      shaped.push(joinsPrev ? forms[1] : forms[0]);
      i++;
      continue;
    }
    const forms = ARABIC_FORMS[ch];
    if (!forms) {
      shaped.push(ch);
      continue;
    }
    const prev = chars[i - 1];
    const nextCh = chars[i + 1];
    const joinsPrev = !!prev && canJoinAfter(prev) && canJoinBefore(ch);
    const joinsNext = !!nextCh && canJoinAfter(ch) && canJoinBefore(nextCh);
    if (joinsPrev && joinsNext && forms[3]) shaped.push(forms[3]);
    else if (joinsPrev) shaped.push(forms[1]);
    else if (joinsNext && forms[2]) shaped.push(forms[2]);
    else shaped.push(forms[0]);
  }
  return shaped.join("");
}

function shapeForPdf(text: string): string {
  // pdf-lib does not run Arabic shaping/bidi. Convert Arabic letters into their
  // presentation forms, then reverse the visual run for left-to-right drawing.
  if (!hasArabic(text)) return text;
  const shaped = text.replace(/[\u0600-\u06FF\u064B-\u065F\u0670]+/g, (run) => shapeArabicRun(run));
  return Array.from(shaped).reverse().join("");
}

function normalizePages(input: unknown): NormalizedPage[] {
  if (!Array.isArray(input)) return [];
  return input.map((raw, i) => {
    const p = (raw ?? {}) as PageInput;
    const explicitNumber = typeof p.page_number === "number" ? p.page_number : typeof p.index === "number" ? p.index + 1 : i + 1;
    return {
      pageNumber: Math.max(1, explicitNumber),
      text: normalizeText(p.text ?? p.content ?? p.narration),
      imageUrl: (p.illustration_url ?? p.image_url ?? p.imageUrl ?? null) || null,
      emotionTag: (p.emotion_tag ?? p.emotionTag ?? null) || null,
    };
  }).filter((p) => p.text.length > 0).slice(0, MAX_PAGES);
}

function wrap(text: string, font: { widthOfTextAtSize: (t: string, s: number) => number }, size: number, maxWidth: number): string[] {
  const paragraphs = normalizeText(text).split(/\n{2,}/).filter(Boolean);
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";
    for (const word of words) {
      const tentative = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(shapeForPdf(tentative), size) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else if (font.widthOfTextAtSize(shapeForPdf(word), size) > maxWidth) {
        if (line) lines.push(line);
        let chunk = "";
        for (const ch of Array.from(word)) {
          const test = `${chunk}${ch}`;
          if (font.widthOfTextAtSize(shapeForPdf(test), size) > maxWidth && chunk) {
            lines.push(chunk);
            chunk = ch;
          } else chunk = test;
        }
        line = chunk;
      } else {
        line = tentative;
      }
    }
    if (line) lines.push(line);
    lines.push("");
  }
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`fetch_failed_${response.status}`);
  const len = Number(response.headers.get("content-length") || "0");
  if (len > MAX_IMAGE_BYTES) throw new Error("image_too_large");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("image_too_large");
  return bytes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return friendly("method_not_allowed", 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return friendly("unauthorized", 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return friendly("unauthorized", 401);
  const userId = userData.user.id;

  let payload: ExportPdfRequest;
  try { payload = (await req.json()) as ExportPdfRequest; }
  catch { return friendly("invalid_json", 400); }

  const storyId = payload.story_id ?? payload.storyId ?? null;
  const force = payload.force === true;
  const skipImages = payload.skipImages === true;
  const maxImages = typeof payload.maxImages === "number" ? Math.max(0, Math.min(MAX_IMAGES, payload.maxImages)) : MAX_IMAGES;

  const rl = await checkRateLimit(`u:${userId}`, "export-story-pdf", { windowSec: 3600, max: 8, blockSec: 600 });
  if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });

  let title = normalizeText(payload.title) || "My Story";
  let language = (payload.language || "en").toLowerCase().slice(0, 10);
  let pages = normalizePages(payload.pages);
  let existingPdfUrl: string | null = null;
  let childId = payload.child_id ?? null;

  if (storyId && pages.length === 0) {
    const { data: paidAllowed, error: gateErr } = await admin.rpc("has_paid_feature", { _user_id: userId, _feature: "pdf" });
    if (gateErr) {
      console.error("[export-story-pdf] gate check failed", gateErr);
      return friendly("subscription_check_failed", 500);
    }
    if (!paidAllowed && !isAdmin) return json({ error: "subscription_required", feature: "pdf", blocked: true }, 200);

    const { data: story, error: storyErr } = await admin
      .from("ai_story_history")
      .select("id,user_id,title,pages,generated_story,language,pdf_url,child_profile_id")
      .eq("id", storyId)
      .maybeSingle();
    if (storyErr || !story) return friendly("story_not_found", 404);
    if (story.user_id !== userId && !isAdmin) return friendly("forbidden", 403);

    title = normalizeText(story.title) || title;
    language = (story.language || language).toLowerCase().slice(0, 10);
    childId = story.child_profile_id ?? childId;
    existingPdfUrl = typeof story.pdf_url === "string" ? story.pdf_url : null;
    pages = normalizePages(story.pages);
    if (pages.length === 0) {
      const fullText = normalizeText((story.generated_story as { text?: unknown } | null)?.text);
      pages = fullText
        .split(/\n{2,}|(?<=[.!?؟])\s+/)
        .map((text, i) => ({ pageNumber: i + 1, text, imageUrl: null, emotionTag: null }))
        .filter((p) => p.text.length > 0)
        .slice(0, MAX_PAGES);
    }

    if (!force && existingPdfUrl) {
      const exportRow = await admin.from("exports").insert({
        user_id: userId,
        story_id: storyId,
        child_id: childId,
        type: "pdf",
        language,
        status: "ready",
        file_path: null,
        signed_url: existingPdfUrl,
        provider: "local",
        metadata: { title, reused: true },
        pdf_metadata: { page_count: pages.length },
      }).select("id").single();
      return json({
        success: true,
        export_id: exportRow.data?.id ?? storyId,
        download_url: existingPdfUrl,
        preview_url: existingPdfUrl,
        file_name: `${slug(title)}.pdf`,
        file_size: null,
        page_count: pages.length,
        provider: "local",
        expires_at: new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
        reused: true,
      });
    }
  }

  if (!title) return friendly("title_required", 400);
  if (pages.length === 0) return friendly("pages_required", 400);
  if (pages.length > MAX_PAGES) return friendly("too_many_pages", 400, { max_pages: MAX_PAGES });

  // ONE illustrated PDF behaviour: whenever the story has illustrations
  // persisted by `illustrate-story`, attach them to the matching page so the
  // customer-facing download is the illustrated book (never a text-only file).
  // Pages that already carry an image keep it; missing ones stay text-only.
  if (storyId && !skipImages && pages.some((p) => !p.imageUrl)) {
    const { data: illus, error: illusErr } = await admin
      .from("generated_illustrations")
      .select("page_index,image_url,status")
      .eq("story_id", storyId)
      .eq("status", "ready");
    if (illusErr) {
      console.warn("[export-story-pdf] illustration lookup failed", illusErr.message);
    } else {
      const byIndex = new Map<number, string>();
      for (const row of illus ?? []) {
        const idx = Number(row.page_index);
        const url = typeof row.image_url === "string" ? row.image_url : "";
        if (Number.isFinite(idx) && url) byIndex.set(idx, url);
      }
      if (byIndex.size > 0) {
        pages = pages.map((p) => (p.imageUrl ? p : { ...p, imageUrl: byIndex.get(p.pageNumber) ?? null }));
        console.info("[export-story-pdf] attached illustrations", { storyId, matched: pages.filter((p) => !!p.imageUrl).length });
      }
    }
  }

  const { data: exportRow, error: insertErr } = await admin.from("exports").insert({
    user_id: userId,
    story_id: storyId,
    child_id: childId,
    type: "pdf",
    language,
    status: "generating",
    metadata: { title, child_name: payload.child_name ?? null, emotion_tags: payload.emotion_tags ?? [] },
    pdf_metadata: { page_count: pages.length, theme_color: payload.theme_color ?? null },
  }).select("id").single();

  if (insertErr || !exportRow) {
    console.error("[export-story-pdf] db insert failed", insertErr);
    return friendly("db_insert_failed", 500);
  }
  const exportId = exportRow.id as string;

  try {
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit);
    let font;
    let bold;
    let latinFont;
    let latinBold;
    try {
      const [fontBytes, boldBytes, latinBytes, latinBoldBytes] = await Promise.all([
        fetchBytes(ARABIC_FONT_URL),
        fetchBytes(ARABIC_FONT_BOLD_URL),
        fetchBytes(LATIN_FONT_URL),
        fetchBytes(LATIN_FONT_BOLD_URL),
      ]);
      font = await doc.embedFont(fontBytes, { subset: true });
      bold = await doc.embedFont(boldBytes, { subset: true });
      latinFont = await doc.embedFont(latinBytes, { subset: true });
      latinBold = await doc.embedFont(latinBoldBytes, { subset: true });
    } catch (fontErr) {
      console.error("[export-story-pdf] font load failed", fontErr);
      return friendly("pdf_font_failed", 500);
    }

    const pageW = 595;
    const pageH = 842;
    const margin = 50;
    const textSize = hasArabic(`${title}\n${pages.map((p) => p.text).join("\n")}`) ? 15 : 14;

    const cover = doc.addPage([pageW, pageH]);
    cover.drawRectangle({ x: 0, y: 0, width: pageW, height: pageH, color: rgb(0.05, 0.09, 0.2) });
    const titleLines = wrap(title, bold, 28, pageW - margin * 2).slice(0, 6);
    let coverY = pageH - 190;
    for (const line of titleLines) {
      const shaped = shapeForPdf(line);
      const x = hasArabic(line) ? pageW - margin - bold.widthOfTextAtSize(shaped, 28) : margin;
      cover.drawText(shaped, { x, y: coverY, size: 28, font: bold, color: rgb(1, 0.95, 0.72) });
      coverY -= 40;
    }
    if (payload.child_name) {
      const childLine = hasArabic(payload.child_name) ? payload.child_name : `for ${payload.child_name}`;
      const shaped = shapeForPdf(childLine);
      const x = hasArabic(childLine) ? pageW - margin - font.widthOfTextAtSize(shaped, 18) : margin;
      cover.drawText(shaped, { x, y: coverY - 20, size: 18, font, color: rgb(1, 1, 1) });
    }
    cover.drawText("Najmah Story Studio", { x: margin, y: 58, size: 11, font: latinFont, color: rgb(0.78, 0.84, 1) });

    let embedded = 0;
    let embeddedBytes = 0;
    for (const p of pages) {
      const page = doc.addPage([pageW, pageH]);
      page.drawRectangle({ x: 0, y: 0, width: pageW, height: pageH, color: rgb(0.99, 0.98, 0.95) });
      let cursorY = pageH - margin;

      if (p.imageUrl && !skipImages && embedded < maxImages && embeddedBytes < MAX_TOTAL_IMAGE_BYTES) {
        try {
          const imgBytes = await fetchBytes(p.imageUrl);
          const lowerUrl = p.imageUrl.toLowerCase();
          const img = lowerUrl.includes(".png") ? await doc.embedPng(imgBytes) : await doc.embedJpg(imgBytes);
          const maxImgW = pageW - margin * 2;
          const maxImgH = 300;
          const scale = Math.min(maxImgW / img.width, maxImgH / img.height, 1);
          const w = img.width * scale;
          const h = img.height * scale;
          page.drawImage(img, { x: (pageW - w) / 2, y: cursorY - h, width: w, height: h });
          cursorY -= h + 20;
          embedded++;
          embeddedBytes += imgBytes.byteLength;
        } catch (imageErr) {
          console.warn("[export-story-pdf] image skipped", imageErr);
        }
      }

      page.drawText(`Page ${p.pageNumber}`, { x: margin, y: cursorY, size: 10, font: latinFont, color: rgb(0.38, 0.38, 0.45) });
      if (p.emotionTag) {
        const label = p.emotionTag.toUpperCase();
        page.drawText(label, { x: pageW - margin - Math.min(180, latinBold.widthOfTextAtSize(label, 10)), y: cursorY, size: 10, font: latinBold, color: rgb(0.35, 0.25, 0.62) });
      }
      cursorY -= 28;

      const lines = wrap(p.text, font, textSize, pageW - margin * 2);
      for (const line of lines) {
        if (cursorY < margin) break;
        const shaped = shapeForPdf(line);
        const x = hasArabic(line) ? pageW - margin - font.widthOfTextAtSize(shaped, textSize) : margin;
        page.drawText(shaped, { x, y: cursorY, size: textSize, font, color: rgb(0.1, 0.1, 0.15) });
        cursorY -= textSize + 7;
      }
    }

    const pdfBytes = await doc.save({ useObjectStreams: true });
    const filename = `${slug(title)}.pdf`;
    const objectPath = `${userId}/${exportId}.pdf`;
    const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString();

    const upload = await admin.storage.from(PDF_BUCKET).upload(objectPath, pdfBytes, { contentType: "application/pdf", upsert: true });
    if (upload.error) {
      await admin.from("exports").update({ status: "failed", error_message: upload.error.message }).eq("id", exportId);
      return friendly("storage_upload_failed", 500);
    }
    const signed = await admin.storage.from(PDF_BUCKET).createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS, { download: filename });
    if (signed.error || !signed.data?.signedUrl) {
      await admin.from("exports").update({ status: "failed", error_message: signed.error?.message ?? "sign_failed" }).eq("id", exportId);
      return friendly("sign_url_failed", 500);
    }

    // Bucket is private: reuse the signed URL instead of a public URL.
    const publicUrl = signed.data.signedUrl;
    await admin.from("exports").update({
      status: "ready",
      file_path: objectPath,
      signed_url: signed.data.signedUrl,
      file_size: pdfBytes.byteLength,
      provider: "local",
      expires_at: expiresAt,
      pdf_metadata: { page_count: pages.length, theme_color: payload.theme_color ?? null, embedded_images: embedded },
    }).eq("id", exportId);

    if (storyId) {
      await admin.from("ai_story_history").update({ pdf_url: publicUrl, updated_at: new Date().toISOString() }).eq("id", storyId);
    }

    await admin.from("export_logs").insert({
      export_id: exportId,
      user_id: userId,
      action: "generated",
      details: { provider: "local", bytes: pdfBytes.byteLength, page_count: pages.length, embedded_images: embedded },
    });

    return json({
      success: true,
      export_id: exportId,
      download_url: signed.data.signedUrl,
      preview_url: publicUrl,
      file_name: filename,
      file_size: pdfBytes.byteLength,
      page_count: pages.length,
      provider: "local",
      expires_at: expiresAt,
    });
  } catch (err) {
    console.error("[export-story-pdf] render failed", err);
    await admin.from("exports").update({
      status: "failed",
      error_message: (err as Error).message.slice(0, 500),
    }).eq("id", exportId);
    return friendly("pdf_render_failed", 500, { message: (err as Error).message });
  }
});