// export-story-pdf — Phase 5. Renders an SEL story (text + per-page illustrations)
// into a downloadable PDF, uploads to public `story-pdfs` bucket, returns URL.

import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import { checkRateLimits, rateLimitResponse } from "../_shared/rateLimit.ts";

interface ReqBody { storyId: string }

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  const pre = handlePreflight(req);
  if (pre) return pre;

  // Body size guard (~4KB — only takes a storyId)
  const cl = Number(req.headers.get("content-length") || "0");
  if (cl > 4_096) return json({ error: "payload_too_large" }, 413);

  try {
    const raw = (await req.json().catch(() => ({}))) as Partial<ReqBody>;
    const storyId = typeof raw.storyId === "string" ? raw.storyId.slice(0, 64) : "";
    if (!storyId) return json({ error: "missing_storyId" }, 400);

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return json({ error: "unauthorized" }, 401);

    const rl = await checkRateLimits(`u:${userId}`, "export-story-pdf", [
      { windowSec: 60, max: 2 },
      { windowSec: 3600, max: 10 },
      { windowSec: 86400, max: 30 },
    ]);
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

    // Server-side subscription gate
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: paidAllowed, error: gateErr } = await admin.rpc("has_paid_feature", {
      _user_id: userId,
      _feature: "pdf",
    });
    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (gateErr) {
      console.error("[pdf] gate check failed", gateErr);
      return json({ error: "subscription_check_failed" }, 500);
    }
    if (roleErr) console.error("[pdf] admin gate check failed", roleErr);
    const allowed = !!paidAllowed || !!isAdmin;
    if (!allowed) {
      return json({ error: "subscription_required", feature: "pdf", blocked: true }, 200);
    }

    const { data: story, error: sErr } = await supabase
      .from("ai_story_history")
      .select("id, user_id, title, pages, sel_outcome, language")
      .eq("id", storyId)
      .single();
    if (sErr || !story) return json({ error: "story_not_found" }, 404);
    if (story.user_id !== userId) return json({ error: "forbidden" }, 403);

    const { data: ills } = await supabase
      .from("generated_illustrations")
      .select("page_index,image_url,status")
      .eq("story_id", storyId);
    const illMap = new Map<number, string>();
    for (const i of ills ?? []) {
      if (i.image_url && i.status === "ready") illMap.set(i.page_index as number, i.image_url as string);
    }

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    // Cover
    const cover = pdf.addPage([595, 842]);
    cover.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(0.06, 0.08, 0.18) });
    drawWrapped(cover, story.title ?? "My Story", { x: 60, y: 600, width: 475, font: fontBold, size: 36, color: rgb(1, 1, 1) });
    const outcome = (story.sel_outcome as { statement?: string } | null)?.statement;
    if (outcome) {
      drawWrapped(cover, outcome, { x: 60, y: 480, width: 475, font, size: 14, color: rgb(0.85, 0.88, 1) });
    }
    cover.drawText("Najmah", { x: 60, y: 60, size: 12, font, color: rgb(0.7, 0.75, 0.95) });

    const pages = (story.pages as Array<{ index: number; text: string; emotionTag?: string }>) ?? [];
    pages.sort((a, b) => a.index - b.index);

    for (const p of pages) {
      const page = pdf.addPage([595, 842]);
      page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(0.99, 0.98, 0.95) });

      const url = illMap.get(p.index);
      if (url) {
        try {
          const r = await fetch(url);
          if (r.ok) {
            const ct = r.headers.get("content-type") ?? "";
            const bytes = new Uint8Array(await r.arrayBuffer());
            const img = ct.includes("png")
              ? await pdf.embedPng(bytes)
              : await pdf.embedJpg(bytes);
            const maxW = 475, maxH = 360;
            const ratio = Math.min(maxW / img.width, maxH / img.height);
            const w = img.width * ratio, h = img.height * ratio;
            page.drawImage(img, { x: (595 - w) / 2, y: 842 - 60 - h, width: w, height: h });
          }
        } catch (e) {
          console.error("img embed failed", e);
        }
      }

      drawWrapped(page, p.text ?? "", { x: 60, y: 360, width: 475, font, size: 14, color: rgb(0.1, 0.1, 0.15), lineHeight: 20 });
      page.drawText(`Page ${p.index}`, { x: 60, y: 40, size: 10, font, color: rgb(0.4, 0.4, 0.5) });
      if (p.emotionTag) {
        page.drawText(p.emotionTag.toUpperCase(), { x: 595 - 60 - fontBold.widthOfTextAtSize(p.emotionTag.toUpperCase(), 10), y: 40, size: 10, font: fontBold, color: rgb(0.4, 0.3, 0.7) });
      }
    }

    const bytes = await pdf.save();
    const path = `${userId}/${storyId}.pdf`;
    const { error: upErr } = await admin.storage
      .from("story-pdfs")
      .upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (upErr) {
      console.error("pdf upload", upErr);
      return json({ error: "upload_failed" }, 500);
    }
    const { data: pub } = supabase.storage.from("story-pdfs").getPublicUrl(path);
    const pdfUrl = pub.publicUrl;
    await supabase.from("ai_story_history").update({ pdf_url: pdfUrl }).eq("id", storyId);

    return json({ pdfUrl }, 200);
  } catch (e) {
    console.error("export-story-pdf error", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

interface DrawOpts {
  x: number; y: number; width: number;
  font: import("https://esm.sh/pdf-lib@1.17.1").PDFFont;
  size: number; color: ReturnType<typeof rgb>;
  lineHeight?: number;
}

function drawWrapped(page: import("https://esm.sh/pdf-lib@1.17.1").PDFPage, text: string, o: DrawOpts) {
  const lh = o.lineHeight ?? o.size * 1.3;
  const words = (text ?? "").split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (o.font.widthOfTextAtSize(test, o.size) > o.width) {
      if (cur) lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  let y = o.y;
  for (const line of lines) {
    page.drawText(line, { x: o.x, y, size: o.size, font: o.font, color: o.color });
    y -= lh;
  }
}

function json(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
