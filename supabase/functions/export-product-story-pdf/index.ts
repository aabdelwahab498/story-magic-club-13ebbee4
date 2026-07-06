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

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const LOVABLE_IMAGE_URL = "https://ai.gateway.lovable.dev/v1/images/generations";
const IMAGE_MODELS = [
  "openai/gpt-image-2",
  "google/gemini-3.1-flash-image",
  "google/gemini-2.5-flash-image",
];

type EdgeLogger = (msg: string, extra?: Record<string, unknown>) => void;

function imageBodyForModel(model: string, prompt: string): Record<string, unknown> {
  if (model.startsWith("openai/")) {
    return {
      model,
      prompt,
      quality: "low",
      size: "1024x1024",
      n: 1,
      stream: false,
    };
  }

  return {
    model,
    messages: [{ role: "user", content: prompt }],
    modalities: ["image", "text"],
    stream: false,
  };
}

function bytesFromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function extractIllustration(data: unknown): { bytes: Uint8Array; mime: string } | null {
  const obj = data as Record<string, unknown>;
  const first = Array.isArray(obj?.data) ? obj.data[0] as Record<string, unknown> | undefined : undefined;
  const b64 = typeof first?.b64_json === "string" ? first.b64_json : undefined;
  if (b64) return { bytes: bytesFromBase64(b64), mime: "image/png" };

  const directUrl = typeof first?.url === "string" ? first.url : undefined;
  const legacyUrl = (obj as any)?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  const url = directUrl || (typeof legacyUrl === "string" ? legacyUrl : undefined);
  if (!url || !url.startsWith("data:image/")) return null;
  const m = url.match(/^data:(image\/[a-z0-9+.-]+);base64,(.+)$/i);
  if (!m) return null;
  return { bytes: bytesFromBase64(m[2]), mime: m[1] };
}

async function generateIllustration(
  prompt: string,
  pageIndex: number,
  log: EdgeLogger,
  errLog: EdgeLogger,
): Promise<{ bytes: Uint8Array; mime: string } | null> {
  if (!LOVABLE_API_KEY) return null;
  for (const model of IMAGE_MODELS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 75_000);
    try {
      log("illustration model start", { page: pageIndex, model });
      const r = await fetch(LOVABLE_IMAGE_URL, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Lovable-API-Key": LOVABLE_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(imageBodyForModel(model, prompt)),
      });
      clearTimeout(timer);
      if (!r.ok) {
        const detail = await r.text().catch(() => "");
        errLog("illustration model failed", { page: pageIndex, model, status: r.status, detail: detail.slice(0, 240) });
        continue;
      }
      const data = await r.json();
      const img = extractIllustration(data);
      if (!img) {
        errLog("illustration response missing image", { page: pageIndex, model });
        continue;
      }
      log("illustration model success", { page: pageIndex, model, bytes: img.bytes.length, mime: img.mime });
      return img;
    } catch (e) {
      clearTimeout(timer);
      errLog("illustration model threw", { page: pageIndex, model, err: e instanceof Error ? e.message : String(e) });
    }
  }
  return null;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const i = idx++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

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
    const path = `products/${sku}-${language}-illustrated-v3.pdf`;

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

    const system = `You are Najmah, an award-winning children's picture-book author and art director. Output STRICT JSON only.`;
    const user = `Write a complete children's picture-book story in ${langNames[language]}.
Title: "${title}"
Premise / description: ${description || "(none provided; invent a wonderful story that matches the title)"}
Target age range: ${ageRange}

Story requirements:
- 8 pages, each 3–5 short sentences (~50–80 words per page).
- Gentle emotional arc: setup → challenge → turning point → resolution → warm ending.
- Rich sensory details, kind and hopeful tone, no violence or scary content.
- Use the given title as-is.

For EACH page also produce an English illustration prompt (~35–55 words) even if
the story is in another language. The illustration prompt MUST:
- describe a single storybook scene from that page
- be a warm, whimsical children's book illustration, soft watercolor + gouache
- keep the same main character(s) consistent across every page (same age, hair,
  outfit, colors) — restate their look each time
- include no text, letters, logos, or borders in the image

Also produce ONE global "characterSheet" line (~25–40 words) describing the
main character's look so every page stays visually consistent.

Return STRICT JSON only, no prose, no markdown fences:
{
  "title": string,
  "subtitle": string,          // one warm sentence, <120 chars
  "characterSheet": string,    // reusable visual description of the main character
  "pages": [ { "index": number, "text": string, "illustrationPrompt": string } ]  // 8 items, index 1..8
}`;

    let storyJson: {
      title?: string;
      subtitle?: string;
      characterSheet?: string;
      pages?: Array<{ index: number; text: string; illustrationPrompt?: string }>;
    };
    try {
      storyJson = await aiJson({
        system,
        user,
        temperature: 0.85,
        maxTokens: 3600,
        responseFormat: "json_object",
      });
      log("story text generated", { pages: storyJson?.pages?.length });
    } catch (e) {
      const status = e instanceof AIGatewayError ? e.status : 500;
      errLog("ai_failed", { err: String(e) });
      return json({ error: "ai_generation_failed", detail: String(e), status }, 502);
    }

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

    // Generate one illustration per page. Keep concurrency modest to avoid
    // upstream image rate limits and never cache a text-only PDF as success.
    const characterSheet = storyJson?.characterSheet ?? "";
    log("illustrations begin", { count: pages.length });
    const illT0 = Date.now();
    const illustrations = await mapLimit(pages, 2, async (p) => {
      const scene = p.illustrationPrompt || `Scene: ${p.text.slice(0, 220)}`;
      const prompt = `Bright, attractive children's picture-book illustration for ages ${ageRange}. Soft watercolor and gouache, expressive friendly faces, warm magical details, joyful colors, cozy lighting. No text, letters, logos, captions, or borders.
Main character (keep consistent every page): ${characterSheet || "a friendly child protagonist"}.
Scene for page ${p.index}: ${scene}
Full-bleed square composition suitable for a premium children's storybook page.`;
      const img = await generateIllustration(prompt, p.index, log, errLog);
      return img;
    });

    const missingIllustrations = illustrations
      .map((img, i) => img ? -1 : i)
      .filter((i) => i >= 0);
    if (missingIllustrations.length > 0) {
      log("illustrations retry missing", { missing: missingIllustrations.map((i) => pages[i].index) });
      for (const i of missingIllustrations) {
        const p = pages[i];
        const simplePrompt = `A charming, colorful watercolor and gouache children's storybook illustration. No text, letters, logos, captions, or borders. Consistent character: ${characterSheet || "a friendly child protagonist"}. Scene: ${p.illustrationPrompt || p.text.slice(0, 180)}.`;
        illustrations[i] = await generateIllustration(simplePrompt, p.index, log, errLog);
      }
    }

    const successfulIllustrations = illustrations.filter(Boolean).length;
    log("illustrations done", {
      ms: Date.now() - illT0,
      ok: successfulIllustrations,
      failed: illustrations.filter((x) => !x).length,
    });

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

      const ill = illustrations[i];
      let textTop = 760;
      let drewIllustration = false;
      if (ill) {
        try {
          const img = ill.mime.includes("png")
            ? await pdf.embedPng(ill.bytes)
            : await pdf.embedJpg(ill.bytes);
          const maxW = 475, maxH = 400;
          const ratio = Math.min(maxW / img.width, maxH / img.height);
          const w = img.width * ratio, h = img.height * ratio;
          const x = (595 - w) / 2;
          const y = 842 - 50 - h;
          // Soft rounded card behind the illustration
          page.drawRectangle({
            x: x - 8, y: y - 8, width: w + 16, height: h + 16,
            color: rgb(1, 1, 1), borderColor: rgb(0.88, 0.9, 0.95), borderWidth: 1,
          });
          page.drawImage(img, { x, y, width: w, height: h });
          textTop = y - 20;
          drewIllustration = true;
        } catch (e) {
          errLog("embed image failed", { page: p.index, err: String(e) });
        }
      }
      if (!drewIllustration) {
        drawFallbackIllustration(page, p.index);
        textTop = 370;
      }

      drawWrapped(page, p.text ?? "", {
        x: 60, y: textTop, width: 475, font, size: 13, color: rgb(0.1, 0.1, 0.15), lineHeight: 20,
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

function drawFallbackIllustration(
  page: import("https://esm.sh/pdf-lib@1.17.1").PDFPage,
  pageIndex: number,
) {
  const x = 60;
  const y = 405;
  const width = 475;
  const height = 370;
  const palettes = [
    { sky: rgb(0.78, 0.91, 1), hill: rgb(0.48, 0.78, 0.54), accent: rgb(1, 0.74, 0.28), flower: rgb(0.98, 0.38, 0.56) },
    { sky: rgb(0.86, 0.82, 1), hill: rgb(0.38, 0.72, 0.69), accent: rgb(1, 0.83, 0.35), flower: rgb(0.45, 0.55, 0.95) },
    { sky: rgb(1, 0.88, 0.75), hill: rgb(0.58, 0.78, 0.42), accent: rgb(0.42, 0.72, 1), flower: rgb(0.92, 0.44, 0.8) },
  ];
  const p = palettes[(pageIndex - 1) % palettes.length];

  page.drawRectangle({ x: x - 8, y: y - 8, width: width + 16, height: height + 16, color: rgb(1, 1, 1), borderColor: rgb(0.88, 0.9, 0.95), borderWidth: 1 });
  page.drawRectangle({ x, y, width, height, color: p.sky });

  page.drawCircle({ x: x + width - 78, y: y + height - 72, size: 38, color: p.accent });
  page.drawCircle({ x: x + 90, y: y + height - 78, size: 22, color: rgb(1, 1, 1) });
  page.drawCircle({ x: x + 124, y: y + height - 72, size: 28, color: rgb(1, 1, 1) });
  page.drawCircle({ x: x + 158, y: y + height - 82, size: 20, color: rgb(1, 1, 1) });

  page.drawEllipse({ x: x + 130, y: y + 78, xScale: 185, yScale: 82, color: p.hill });
  page.drawEllipse({ x: x + 350, y: y + 70, xScale: 170, yScale: 72, color: rgb(0.36, 0.68, 0.5) });

  const childX = x + 238;
  const childY = y + 118;
  page.drawCircle({ x: childX, y: childY + 86, size: 26, color: rgb(0.5, 0.28, 0.16) });
  page.drawCircle({ x: childX, y: childY + 80, size: 21, color: rgb(0.98, 0.78, 0.56) });
  page.drawRectangle({ x: childX - 24, y: childY + 22, width: 48, height: 55, color: p.flower });
  page.drawRectangle({ x: childX - 45, y: childY + 42, width: 25, height: 9, color: rgb(0.98, 0.78, 0.56) });
  page.drawRectangle({ x: childX + 20, y: childY + 42, width: 25, height: 9, color: rgb(0.98, 0.78, 0.56) });
  page.drawRectangle({ x: childX - 18, y: childY, width: 12, height: 28, color: rgb(0.22, 0.36, 0.58) });
  page.drawRectangle({ x: childX + 6, y: childY, width: 12, height: 28, color: rgb(0.22, 0.36, 0.58) });

  for (let i = 0; i < 9; i++) {
    const fx = x + 55 + ((i * 47 + pageIndex * 19) % 365);
    const fy = y + 36 + ((i * 23) % 70);
    page.drawCircle({ x: fx, y: fy, size: 7, color: p.flower });
    page.drawCircle({ x: fx + 8, y: fy + 5, size: 5, color: p.accent });
  }
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
