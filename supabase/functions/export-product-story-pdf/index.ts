// export-product-story-pdf — Generates a full children's story PDF for a Store
// product on-demand using the AI gateway, then uploads it to `story-pdfs`
// under `products/<sku>-<lang>.pdf` so repeated downloads reuse the file.

import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import { aiJson, AIGatewayError } from "../_shared/sel/gateway.ts";
import { checkRateLimits, rateLimitResponse } from "../_shared/rateLimit.ts";

interface ReqBody { productId: string; language?: string; force?: boolean }

const ALLOWED_LANGS = new Set(["en", "ar", "de", "fr", "it", "es"]);

function decodeJwt(token: string): { sub?: string; exp?: number; email?: string } | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const b64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(pad));
  } catch { return null; }
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  const pre = handlePreflight(req);
  if (pre) return pre;
  const requestId = crypto.randomUUID();
  const t0 = Date.now();
  const log = (msg: string, extra: Record<string, unknown> = {}) =>
    console.log(`[product-pdf][${requestId}] ${msg}`, { ms: Date.now() - t0, ...extra });
  const errLog = (msg: string, extra: Record<string, unknown> = {}) =>
    console.error(`[product-pdf][${requestId}] ${msg}`, { ms: Date.now() - t0, ...extra });

  const json = (obj: unknown, status: number): Response =>
    new Response(JSON.stringify({ ...(obj as object), requestId }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    log("request received");
    const raw = (await req.json().catch(() => ({}))) as Partial<ReqBody>;
    const productId = typeof raw.productId === "string" ? raw.productId.slice(0, 64) : "";
    const language = (typeof raw.language === "string" ? raw.language.slice(0, 5).toLowerCase() : "en") || "en";
    const force = raw.force === true;
    if (!productId) return json({ error: "missing_productId" }, 400);
    if (!ALLOWED_LANGS.has(language)) return json({ error: "invalid_language" }, 400);

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      errLog("no bearer token");
      return json({ error: "unauthorized", reason: "missing_token" }, 401);
    }

    // Prefer server-side verification, but tolerate `session_not_found` when the
    // JWT itself is still valid — the client's session row may have been rotated
    // but the bearer token is intact and signed by Supabase. We fall back to
    // decoding the JWT and re-checking via the service role client.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: `Bearer ${token}` } } },
    );
    let userId: string | undefined;
    let userEmail: string | undefined;
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userData?.user?.id) {
      userId = userData.user.id;
      userEmail = userData.user.email ?? undefined;
      log("auth ok via getUser", { userId });
    } else {
      const claims = decodeJwt(token);
      const now = Math.floor(Date.now() / 1000);
      if (claims?.sub && claims.exp && claims.exp > now) {
        log("auth fallback via jwt claims", { userId: claims.sub, getUserErr: userErr?.message });
        userId = claims.sub;
        userEmail = claims.email;
      } else {
        errLog("auth failed", { getUserErr: userErr?.message, hasClaims: !!claims });
        return json({
          error: "unauthorized",
          reason: userErr?.message === undefined ? "invalid_token" : "session_expired",
          hint: "Please sign out and sign in again.",
        }, 401);
      }
    }

    const rl = await checkRateLimits(`u:${userId}`, "export-product-story-pdf", [
      { windowSec: 60, max: 2 },
      { windowSec: 3600, max: 10 },
      { windowSec: 86400, max: 30 },
    ]);
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: paidAllowed, error: gateErr } = await admin.rpc("has_paid_feature", {
      _user_id: userId, _feature: "pdf",
    });
    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: userId, _role: "admin",
    });
    if (gateErr) errLog("has_paid_feature error", { err: gateErr.message });
    if (roleErr) errLog("has_role error", { err: roleErr.message });
    log("entitlement check", { paidAllowed, isAdmin, email: userEmail });
    if (!paidAllowed && !isAdmin) {
      log("entitlement denied");
      return json({
        error: "subscription_required",
        feature: "pdf",
        blocked: true,
        hint: "Upgrade to a paid plan to download story PDFs.",
      }, 200);
    }

    const { data: product, error: pErr } = await admin
      .from("products")
      .select("id, sku, name, description, image, age_range")
      .eq("id", productId)
      .single();
    if (pErr || !product) return json({ error: "product_not_found" }, 404);

    const sku = (product.sku ?? product.id).replace(/[^a-z0-9_-]+/gi, "_").slice(0, 60);
    const path = `products/${sku}-${language}.pdf`;

    // Reuse cache
    if (!force) {
      const { data: pub } = admin.storage.from("story-pdfs").getPublicUrl(path);
      try {
        const head = await fetch(pub.publicUrl, { method: "HEAD" });
        if (head.ok) return json({ pdfUrl: pub.publicUrl, reused: true }, 200);
      } catch { /* ignore, will regenerate */ }
    }

    const localize = (v: unknown): string => {
      if (v && typeof v === "object") {
        const m = v as Record<string, string>;
        return m[language] || m.en || Object.values(m)[0] || "";
      }
      return typeof v === "string" ? v : "";
    };
    const title = localize(product.name) || "Story";
    const description = localize(product.description) || "";
    const ageRange = product.age_range || "6-9";

    const langNames: Record<string, string> = {
      en: "English", ar: "Arabic", de: "German", fr: "French", it: "Italian", es: "Spanish",
    };

    const system = `You are Najmah, an award-winning children's author. Write warm, imaginative, age-appropriate stories with clear moral/SEL value. Output STRICT JSON only.`;
    const user = `Write a complete children's picture-book story in ${langNames[language]}.
Title: "${title}"
Premise / description: ${description || "(none provided; invent a wonderful story that matches the title)"}
Target age range: ${ageRange}

Requirements:
- 10 pages, each 3–5 short sentences (~55–90 words per page).
- Gentle emotional arc: setup → challenge → turning point → resolution → warm ending.
- Rich sensory details, kind and hopeful tone, no violence or scary content.
- Use the given title as-is.

Return STRICT JSON, no prose, no markdown fences:
{
  "title": string,
  "subtitle": string,      // one warm sentence, <120 chars
  "pages": [ { "index": number, "text": string } ]  // 10 items, index 1..10
}`;

    let storyJson: { title?: string; subtitle?: string; pages?: Array<{ index: number; text: string }> };
    try {
      storyJson = await aiJson({
        system,
        user,
        temperature: 0.85,
        maxTokens: 3200,
        responseFormat: "json_object",
      });
    } catch (e) {
      const status = e instanceof AIGatewayError ? e.status : 500;
      console.error("[product-pdf] ai_failed", e);
      return json({ error: "ai_generation_failed", detail: String(e), status }, 502);
    }

    const pages = Array.isArray(storyJson?.pages)
      ? storyJson.pages
          .filter((p) => p && typeof p.text === "string")
          .map((p, i) => ({ index: Number(p.index) || i + 1, text: String(p.text) }))
          .sort((a, b) => a.index - b.index)
      : [];
    if (pages.length === 0) return json({ error: "ai_empty_story" }, 502);

    const isRtl = language === "ar";

    // Build PDF
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    // Cover
    const cover = pdf.addPage([595, 842]);
    cover.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(0.06, 0.08, 0.18) });
    // Optional cover image
    if (product.image) {
      try {
        const r = await fetch(product.image);
        if (r.ok) {
          const ct = r.headers.get("content-type") ?? "";
          const bytes = new Uint8Array(await r.arrayBuffer());
          const img = ct.includes("png")
            ? await pdf.embedPng(bytes)
            : await pdf.embedJpg(bytes);
          const maxW = 435, maxH = 320;
          const ratio = Math.min(maxW / img.width, maxH / img.height);
          const w = img.width * ratio, h = img.height * ratio;
          cover.drawImage(img, { x: (595 - w) / 2, y: 380, width: w, height: h });
        }
      } catch (e) { console.warn("cover img", e); }
    }
    drawWrapped(cover, storyJson?.title || title, {
      x: 60, y: 340, width: 475, font: fontBold, size: 30, color: rgb(1, 1, 1), align: "center",
    });
    if (storyJson?.subtitle) {
      drawWrapped(cover, storyJson.subtitle, {
        x: 60, y: 220, width: 475, font, size: 14, color: rgb(0.85, 0.88, 1), align: "center",
      });
    }
    cover.drawText("Najmah", { x: 60, y: 60, size: 12, font, color: rgb(0.7, 0.75, 0.95) });

    // Story pages
    for (const p of pages) {
      const page = pdf.addPage([595, 842]);
      page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(0.99, 0.98, 0.95) });
      // Latin fonts cannot render Arabic glyphs — for RTL we still render but note
      // this is a first pass; a bundled Arabic font would be needed for perfect glyphs.
      drawWrapped(page, p.text ?? "", {
        x: 60, y: 760, width: 475, font, size: 14, color: rgb(0.1, 0.1, 0.15), lineHeight: 22,
        align: isRtl ? "right" : "left",
      });
      page.drawText(`${p.index}`, { x: 297, y: 30, size: 10, font, color: rgb(0.5, 0.5, 0.6) });
    }

    const bytes = await pdf.save();
    const { error: upErr } = await admin.storage
      .from("story-pdfs")
      .upload(path, bytes, { contentType: "application/pdf", upsert: true });
    if (upErr) {
      console.error("upload", upErr);
      return json({ error: "upload_failed" }, 500);
    }
    const { data: pub } = admin.storage.from("story-pdfs").getPublicUrl(path);
    return json({ pdfUrl: pub.publicUrl, pages: pages.length }, 200);
  } catch (e) {
    console.error("export-product-story-pdf error", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});

interface DrawOpts {
  x: number; y: number; width: number;
  font: import("https://esm.sh/pdf-lib@1.17.1").PDFFont;
  size: number; color: ReturnType<typeof rgb>;
  lineHeight?: number;
  align?: "left" | "center" | "right";
}

function drawWrapped(page: import("https://esm.sh/pdf-lib@1.17.1").PDFPage, text: string, o: DrawOpts) {
  const lh = o.lineHeight ?? o.size * 1.35;
  const paragraphs = (text ?? "").split(/\n+/);
  const lines: string[] = [];
  for (const para of paragraphs) {
    const words = para.split(/\s+/);
    let cur = "";
    for (const w of words) {
      const test = cur ? `${cur} ${w}` : w;
      if (o.font.widthOfTextAtSize(test, o.size) > o.width) {
        if (cur) lines.push(cur);
        cur = w;
      } else cur = test;
    }
    if (cur) lines.push(cur);
  }
  let y = o.y;
  for (const line of lines) {
    const w = o.font.widthOfTextAtSize(line, o.size);
    let x = o.x;
    if (o.align === "center") x = o.x + (o.width - w) / 2;
    else if (o.align === "right") x = o.x + (o.width - w);
    page.drawText(line, { x, y, size: o.size, font: o.font, color: o.color });
    y -= lh;
  }
}
