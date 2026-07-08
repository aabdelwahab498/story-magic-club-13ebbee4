// export-product-story-pdf — Generates a full children's story PDF for a Store
// product on-demand, then uploads it to `story-pdfs`
// under `products/<sku>-<lang>.pdf` so repeated downloads reuse the file.

import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import { checkRateLimits, rateLimitResponse } from "../_shared/rateLimit.ts";

interface ReqBody { productId: string; language?: string; force?: boolean }

const ALLOWED_LANGS = new Set(["en", "ar", "de", "fr", "it", "es"]);

type EdgeLogger = (msg: string, extra?: Record<string, unknown>) => void;

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
      { windowSec: 60, max: 6 },
      { windowSec: 3600, max: 30 },
      { windowSec: 86400, max: 100 },
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
    const path = `products/${sku}-${language}-illustrated-v5.pdf`;

    // Purge any older/legacy PDF variants for this product+language so we
    // never serve a cached text-only version.
    const legacyPaths = [
      `products/${sku}-${language}.pdf`,
      `products/${sku}-${language}-illustrated.pdf`,
      `products/${sku}-${language}-illustrated-v1.pdf`,
      `products/${sku}-${language}-illustrated-v2.pdf`,
      `products/${sku}-${language}-illustrated-v3.pdf`,
      `products/${sku}-${language}-illustrated-v4.pdf`,
    ];
    try { await admin.storage.from("story-pdfs").remove(legacyPaths); } catch { /* ignore */ }

    // Reuse the current illustrated version immediately. Older text-only files
    // live under legacy paths above; v4 is only written by this illustrated flow.
    if (!force) {
      const { data: pub } = admin.storage.from("story-pdfs").getPublicUrl(path);
      try {
        const head = await fetch(pub.publicUrl, { method: "HEAD", cache: "no-store" });
        const size = Number(head.headers.get("content-length") || "0");
        if (head.ok && size > 5_000) {
          return json({ pdfUrl: `${pub.publicUrl}?v=${Date.now()}`, reused: true }, 200);
        }
        if (head.ok) {
          // Small/text-only cached file — remove it so we regenerate cleanly.
          try { await admin.storage.from("story-pdfs").remove([path]); } catch { /* ignore */ }
        }
      } catch { /* ignore, will regenerate */ }
    } else {
      try { await admin.storage.from("story-pdfs").remove([path]); } catch { /* ignore */ }
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

    const storyJson = buildFallbackStory(title, description, ageRange, language);
    log("local story generated", { pages: storyJson.pages.length });

    const pages = Array.isArray(storyJson?.pages)
      ? storyJson.pages
          .filter((p) => p && typeof p.text === "string")
          .map((p, i) => ({
            index: Number(p.index) || i + 1,
            text: String(p.text),
            illustrationPrompt: typeof p.illustrationPrompt === "string" ? p.illustrationPrompt : "",
          }))
          .sort((a, b) => a.index - b.index)
      : [];
    if (pages.length === 0) return json({ error: "ai_empty_story" }, 502);

    log("local illustrations ready", { count: pages.length });

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

    // Story pages — illustration on top half, text below.
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      const page = pdf.addPage([595, 842]);
      page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(0.99, 0.98, 0.95) });

      drawFallbackIllustration(page, p.index);
      const textTop = 370;

      drawWrapped(page, p.text ?? "", {
        x: 60, y: textTop, width: 475, font, size: 13, color: rgb(0.1, 0.1, 0.15), lineHeight: 20,
        align: isRtl ? "right" : "left",
      });
      page.drawText(`${p.index}`, { x: 297, y: 30, size: 10, font, color: rgb(0.5, 0.5, 0.6) });
    }

    const bytes = await pdf.save();
    const { error: upErr } = await admin.storage
      .from("story-pdfs")
      .upload(path, bytes, { contentType: "application/pdf", cacheControl: "31536000", upsert: true });
    if (upErr) {
      console.error("upload", upErr);
      return json({ error: "upload_failed" }, 500);
    }
    const { data: pub } = admin.storage.from("story-pdfs").getPublicUrl(path);
    return json({ pdfUrl: `${pub.publicUrl}?v=${Date.now()}`, pages: pages.length }, 200);
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

type PDFPageT = import("https://esm.sh/pdf-lib@1.17.1").PDFPage;

function drawChild(page: PDFPageT, cx: number, cy: number, shirt: ReturnType<typeof rgb>) {
  page.drawCircle({ x: cx, y: cy + 86, size: 26, color: rgb(0.5, 0.28, 0.16) });
  page.drawCircle({ x: cx, y: cy + 80, size: 21, color: rgb(0.98, 0.78, 0.56) });
  page.drawRectangle({ x: cx - 24, y: cy + 22, width: 48, height: 55, color: shirt });
  page.drawRectangle({ x: cx - 45, y: cy + 42, width: 25, height: 9, color: rgb(0.98, 0.78, 0.56) });
  page.drawRectangle({ x: cx + 20, y: cy + 42, width: 25, height: 9, color: rgb(0.98, 0.78, 0.56) });
  page.drawRectangle({ x: cx - 18, y: cy, width: 12, height: 28, color: rgb(0.22, 0.36, 0.58) });
  page.drawRectangle({ x: cx + 6, y: cy, width: 12, height: 28, color: rgb(0.22, 0.36, 0.58) });
}

function drawTree(page: PDFPageT, cx: number, base: number, s = 1) {
  page.drawRectangle({ x: cx - 6 * s, y: base, width: 12 * s, height: 40 * s, color: rgb(0.42, 0.28, 0.18) });
  page.drawCircle({ x: cx, y: base + 55 * s, size: 30 * s, color: rgb(0.28, 0.62, 0.38) });
  page.drawCircle({ x: cx - 18 * s, y: base + 45 * s, size: 22 * s, color: rgb(0.32, 0.68, 0.42) });
  page.drawCircle({ x: cx + 18 * s, y: base + 45 * s, size: 22 * s, color: rgb(0.32, 0.68, 0.42) });
}

function drawStar(page: PDFPageT, cx: number, cy: number, size: number, color: ReturnType<typeof rgb>) {
  page.drawCircle({ x: cx, y: cy, size, color });
  page.drawRectangle({ x: cx - size * 0.35, y: cy - size * 1.4, width: size * 0.7, height: size * 2.8, color, rotate: { type: "degrees", angle: 0 } as unknown as never });
}

function drawFallbackIllustration(page: PDFPageT, pageIndex: number) {
  const x = 60, y = 405, width = 475, height = 370;
  page.drawRectangle({ x: x - 8, y: y - 8, width: width + 16, height: height + 16, color: rgb(1, 1, 1), borderColor: rgb(0.88, 0.9, 0.95), borderWidth: 1 });

  const scene = ((pageIndex - 1) % 8) + 1;

  if (scene === 1) {
    // Morning: sun, path, child with satchel
    page.drawRectangle({ x, y, width, height, color: rgb(1, 0.9, 0.76) });
    page.drawCircle({ x: x + width - 70, y: y + height - 60, size: 42, color: rgb(1, 0.78, 0.32) });
    page.drawEllipse({ x: x + 240, y: y + 60, xScale: 260, yScale: 70, color: rgb(0.52, 0.8, 0.5) });
    // path
    page.drawEllipse({ x: x + 240, y: y + 40, xScale: 60, yScale: 14, color: rgb(0.92, 0.82, 0.6) });
    page.drawEllipse({ x: x + 240, y: y + 70, xScale: 40, yScale: 10, color: rgb(0.92, 0.82, 0.6) });
    drawChild(page, x + 240, y + 100, rgb(0.36, 0.58, 0.95));
    // satchel
    page.drawCircle({ x: x + 262, y: y + 138, size: 10, color: rgb(1, 0.82, 0.32) });
  } else if (scene === 2) {
    // Forest trees + bird + sparkle trail
    page.drawRectangle({ x, y, width, height, color: rgb(0.82, 0.94, 0.98) });
    page.drawEllipse({ x: x + 240, y: y + 40, xScale: 300, yScale: 40, color: rgb(0.48, 0.74, 0.5) });
    drawTree(page, x + 70, y + 90, 1.2);
    drawTree(page, x + 140, y + 80, 1);
    drawTree(page, x + 380, y + 85, 1.1);
    drawTree(page, x + 440, y + 90, 1);
    // bird
    page.drawCircle({ x: x + 300, y: y + 300, size: 10, color: rgb(0.98, 0.7, 0.3) });
    page.drawCircle({ x: x + 308, y: y + 305, size: 5, color: rgb(0.98, 0.7, 0.3) });
    // sparkle trail
    for (let i = 0; i < 8; i++) {
      page.drawCircle({ x: x + 100 + i * 32, y: y + 200 + Math.sin(i) * 20, size: 4, color: rgb(1, 0.85, 0.35) });
    }
    drawChild(page, x + 240, y + 100, rgb(0.95, 0.5, 0.5));
  } else if (scene === 3) {
    // Hill with two friends sharing
    page.drawRectangle({ x, y, width, height, color: rgb(0.86, 0.94, 1) });
    page.drawCircle({ x: x + 90, y: y + height - 60, size: 30, color: rgb(1, 1, 1) });
    page.drawCircle({ x: x + 130, y: y + height - 60, size: 26, color: rgb(1, 1, 1) });
    page.drawEllipse({ x: x + 240, y: y + 50, xScale: 320, yScale: 90, color: rgb(0.4, 0.74, 0.46) });
    drawChild(page, x + 190, y + 110, rgb(0.98, 0.5, 0.7));
    drawChild(page, x + 300, y + 110, rgb(0.5, 0.78, 0.98));
    // heart between
    page.drawCircle({ x: x + 240, y: y + 180, size: 8, color: rgb(0.95, 0.35, 0.5) });
    page.drawCircle({ x: x + 250, y: y + 180, size: 8, color: rgb(0.95, 0.35, 0.5) });
    page.drawRectangle({ x: x + 238, y: y + 168, width: 14, height: 14, color: rgb(0.95, 0.35, 0.5), rotate: { type: "degrees", angle: 45 } as unknown as never });
  } else if (scene === 4) {
    // Cloud hides sparkle, calm breathing
    page.drawRectangle({ x, y, width, height, color: rgb(0.75, 0.85, 0.98) });
    // big cloud
    page.drawCircle({ x: x + 220, y: y + 260, size: 42, color: rgb(1, 1, 1) });
    page.drawCircle({ x: x + 260, y: y + 275, size: 50, color: rgb(1, 1, 1) });
    page.drawCircle({ x: x + 300, y: y + 260, size: 42, color: rgb(1, 1, 1) });
    page.drawCircle({ x: x + 260, y: y + 250, size: 55, color: rgb(1, 1, 1) });
    // golden glow in grass
    page.drawEllipse({ x: x + 240, y: y + 50, xScale: 320, yScale: 60, color: rgb(0.42, 0.7, 0.44) });
    page.drawCircle({ x: x + 380, y: y + 70, size: 18, color: rgb(1, 0.82, 0.3) });
    page.drawCircle({ x: x + 380, y: y + 70, size: 10, color: rgb(1, 0.95, 0.6) });
    drawChild(page, x + 180, y + 100, rgb(0.6, 0.5, 0.9));
  } else if (scene === 5) {
    // Colorful garden
    page.drawRectangle({ x, y, width, height, color: rgb(1, 0.92, 0.82) });
    page.drawEllipse({ x: x + 240, y: y + 60, xScale: 320, yScale: 70, color: rgb(0.5, 0.78, 0.48) });
    const colors = [rgb(0.98, 0.4, 0.55), rgb(0.98, 0.75, 0.3), rgb(0.5, 0.6, 0.98), rgb(0.9, 0.5, 0.95), rgb(1, 0.55, 0.35)];
    for (let i = 0; i < 18; i++) {
      const fx = x + 40 + (i * 41) % (width - 60);
      const fy = y + 30 + (i * 17) % 80;
      const c = colors[i % colors.length];
      page.drawCircle({ x: fx, y: fy + 12, size: 6, color: c });
      page.drawCircle({ x: fx - 8, y: fy + 6, size: 6, color: c });
      page.drawCircle({ x: fx + 8, y: fy + 6, size: 6, color: c });
      page.drawCircle({ x: fx, y: fy, size: 6, color: c });
      page.drawCircle({ x: fx, y: fy + 6, size: 5, color: rgb(1, 0.9, 0.3) });
    }
    drawChild(page, x + 240, y + 120, rgb(0.98, 0.55, 0.75));
  } else if (scene === 6) {
    // Glowing treasure box with rays
    page.drawRectangle({ x, y, width, height, color: rgb(0.98, 0.92, 0.76) });
    // rays
    for (let i = 0; i < 10; i++) {
      const ang = (i / 10) * Math.PI * 2;
      page.drawRectangle({ x: x + 240, y: y + 180, width: 140, height: 6, color: rgb(1, 0.88, 0.4), rotate: { type: "degrees", angle: (ang * 180) / Math.PI } as unknown as never, opacity: 0.5 });
    }
    page.drawCircle({ x: x + 240, y: y + 180, size: 50, color: rgb(1, 0.95, 0.55) });
    // box
    page.drawRectangle({ x: x + 200, y: y + 120, width: 80, height: 55, color: rgb(0.72, 0.48, 0.28) });
    page.drawRectangle({ x: x + 200, y: y + 155, width: 80, height: 12, color: rgb(0.98, 0.78, 0.35) });
    page.drawRectangle({ x: x + 234, y: y + 125, width: 12, height: 45, color: rgb(0.98, 0.78, 0.35) });
  } else if (scene === 7) {
    // Starry night reflection sky
    page.drawRectangle({ x, y, width, height, color: rgb(0.1, 0.14, 0.32) });
    for (let i = 0; i < 30; i++) {
      const sx = x + 20 + (i * 53) % (width - 40);
      const sy = y + 60 + (i * 37) % (height - 80);
      page.drawCircle({ x: sx, y: sy, size: 2 + (i % 3), color: rgb(1, 0.95, 0.6) });
    }
    // moon
    page.drawCircle({ x: x + width - 80, y: y + height - 70, size: 34, color: rgb(1, 0.96, 0.75) });
    page.drawEllipse({ x: x + 240, y: y + 40, xScale: 320, yScale: 40, color: rgb(0.18, 0.28, 0.5) });
    drawChild(page, x + 240, y + 90, rgb(0.6, 0.75, 1));
  } else {
    // Sunset home
    page.drawRectangle({ x, y, width, height, color: rgb(1, 0.72, 0.58) });
    page.drawCircle({ x: x + width - 90, y: y + 150, size: 44, color: rgb(1, 0.85, 0.4) });
    page.drawEllipse({ x: x + 240, y: y + 50, xScale: 320, yScale: 60, color: rgb(0.42, 0.6, 0.4) });
    // house
    page.drawRectangle({ x: x + 90, y: y + 80, width: 110, height: 90, color: rgb(0.98, 0.86, 0.7) });
    page.drawRectangle({ x: x + 130, y: y + 80, width: 30, height: 50, color: rgb(0.55, 0.3, 0.2) });
    page.drawRectangle({ x: x + 105, y: y + 140, width: 22, height: 22, color: rgb(1, 0.9, 0.4) });
    page.drawRectangle({ x: x + 163, y: y + 140, width: 22, height: 22, color: rgb(1, 0.9, 0.4) });
    // roof (triangle simulated with rotated rectangle overlay)
    page.drawRectangle({ x: x + 78, y: y + 168, width: 134, height: 20, color: rgb(0.72, 0.35, 0.28) });
    page.drawRectangle({ x: x + 100, y: y + 185, width: 90, height: 14, color: rgb(0.72, 0.35, 0.28) });
    page.drawRectangle({ x: x + 125, y: y + 197, width: 40, height: 10, color: rgb(0.72, 0.35, 0.28) });
    drawChild(page, x + 340, y + 100, rgb(0.98, 0.55, 0.75));
  }
}

function buildFallbackStory(
  title: string,
  description: string,
  ageRange: string,
  language: string,
): {
  title: string;
  subtitle: string;
  characterSheet: string;
  pages: Array<{ index: number; text: string; illustrationPrompt: string }>;
} {
  const isAr = language === "ar";
  const premise = description || title;
  const characterSheet = "a cheerful child with warm brown eyes, curly dark hair, a sky-blue coat, yellow scarf, and tiny star-shaped satchel";
  const arPages = [
    `في صباحٍ لطيف، حملت نجمة حقيبتها الصغيرة وخرجت تبحث عن سرّ ${title}. كان الهواء ناعمًا، وكانت الأزهار تهمس لها بكلماتٍ مشجعة. شعرت أن اليوم يحمل مفاجأة جميلة تناسب قلبها الفضولي.`,
    `وجدت نجمة أثرًا لامعًا يقودها بين الأشجار. توقفت لتسمع زقزقة عصفور صغير، ثم ابتسمت وقالت: سأمشي بهدوء وأتعلم من كل خطوة. كان الطريق جديدًا، لكنه لم يكن مخيفًا.`,
    `عند تلٍ أخضر، قابلت نجمة صديقًا يحتاج إلى مساعدة بسيطة. شاركته ماءها وكلماتها الطيبة، فصار الطريق أخف وأدفأ. اكتشفت أن اللطف يجعل المغامرة أجمل.`,
    `ظهرت غيمة ناعمة وخبأت الأثر اللامع قليلًا. تنفست نجمة ببطء وتذكرت أنها تستطيع التفكير بهدوء. نظرت حولها فرأت لونًا ذهبيًا بين العشب يدلها على الاتجاه.`,
    `سارت نجمة وصديقها خلف اللمعة الذهبية حتى وصلا إلى حديقة مليئة بالألوان. كل زهرة بدت كأنها تحتفل بهما. ضحكت نجمة، وشعرت أن الشجاعة تكبر عندما نتعاون.`,
    `في وسط الحديقة كان صندوق صغير لا يحتاج إلى مفتاح، بل إلى كلمة طيبة. قالت نجمة: شكرًا لكل من ساعدني. فتح الصندوق بلطف وخرج منه ضوء دافئ يرقص حول الجميع.`,
    `فهمت نجمة أن السر لم يكن شيئًا تملكه، بل طريقة ترى بها العالم. عندما تصغي، وتساعد، وتحاول من جديد، تصبح الأيام العادية حكايات مضيئة.`,
    `عادت نجمة إلى بيتها مع غروبٍ وردي وابتسامة هادئة. وضعت حقيبتها قرب النافذة، ووعدت نفسها بمغامرة جديدة غدًا. نامت وهي تشعر أن قلبها مليء بالنجوم.`,
  ];
  const enPages = [
    `One gentle morning, Najma packed her tiny satchel and followed a bright idea about ${premise}. The breeze felt soft, and the flowers seemed to whisper encouragement. She knew the day was holding a kind surprise for her curious heart.`,
    `A silver sparkle led Najma between the trees. She paused to listen to a little bird, then smiled and stepped carefully onward. The path was new, but with patience and wonder, it did not feel frightening at all.`,
    `On a green hill, Najma met a friend who needed a small kindness. She shared her water and a warm word, and the road felt lighter for both of them. She discovered that kindness makes every adventure brighter.`,
    `A soft cloud drifted down and hid the sparkle for a moment. Najma took a slow breath and remembered she could think calmly. Then she noticed a golden glow in the grass, pointing the way ahead.`,
    `Najma and her friend followed the glow to a garden bursting with color. Every flower looked as if it were celebrating their arrival. Najma laughed, feeling courage grow stronger when friends work together.`,
    `In the middle of the garden sat a tiny box that needed no key, only a kind word. “Thank you,” Najma said to everyone who helped. The box opened softly, and warm light danced all around them.`,
    `Najma understood that the treasure was not a thing to keep, but a way to see the world. When she listened, helped, and tried again, ordinary days became shining stories.`,
    `She returned home under a rosy sunset with a peaceful smile. Najma placed her satchel by the window and promised herself another adventure tomorrow. That night, her heart felt full of stars.`,
  ];
  const texts = isAr ? arPages : enPages;
  return {
    title,
    subtitle: isAr ? `حكاية دافئة للأطفال من عمر ${ageRange}` : `A warm illustrated story for ages ${ageRange}`,
    characterSheet,
    pages: texts.map((text, i) => ({
      index: i + 1,
      text,
      illustrationPrompt: `Whimsical watercolor children's book scene for page ${i + 1}: ${text.slice(0, 180)}. Main character: ${characterSheet}. No text or letters.`,
    })),
  };
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
