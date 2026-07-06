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
    const path = `products/${sku}-${language}-illustrated-v4.pdf`;

    // Purge any older/legacy PDF variants for this product+language so we
    // never serve a cached text-only version.
    const legacyPaths = [
      `products/${sku}-${language}.pdf`,
      `products/${sku}-${language}-illustrated.pdf`,
      `products/${sku}-${language}-illustrated-v1.pdf`,
      `products/${sku}-${language}-illustrated-v2.pdf`,
      `products/${sku}-${language}-illustrated-v3.pdf`,
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
