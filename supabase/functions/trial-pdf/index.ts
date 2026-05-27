// trial-pdf — Renders the guest free-trial story into a PDF.
// Anonymous (no auth). Accepts the story payload directly from the client
// (title + pages with text + optional imageUrl/data-url). Returns base64
// PDF inline so we don't need storage policies for guests.
//
// Always tries to succeed — embeds images if available, falls back to
// text-only pages if image fetch fails. Returns 200 with a usable PDF.

import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { PDFDocument, StandardFonts, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import { checkRateLimits, rateLimitResponse } from "../_shared/rateLimit.ts";

interface PageIn {
  index: number;
  text: string;
  emotionTag?: string;
  imageUrl?: string | null; // http(s) URL OR data:image/... URL
}

interface ReqBody {
  title: string;
  pages: PageIn[];
  childName?: string;
  selStatement?: string;
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  return fwd.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

function jsonResp(obj: unknown, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function fetchImageBytes(url: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  try {
    if (url.startsWith("data:image/")) {
      const m = url.match(/^data:(image\/[a-zA-Z0-9+]+);base64,(.+)$/);
      if (!m) return null;
      const mime = m[1];
      const bin = atob(m[2]);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return { bytes, mime };
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) return null;
    const mime = r.headers.get("content-type") ?? "image/jpeg";
    const bytes = new Uint8Array(await r.arrayBuffer());
    return { bytes, mime };
  } catch {
    return null;
  }
}

interface DrawOpts {
  x: number; y: number; width: number;
  // deno-lint-ignore no-explicit-any
  font: any;
  size: number;
  // deno-lint-ignore no-explicit-any
  color: any;
  lineHeight?: number;
}

// deno-lint-ignore no-explicit-any
function drawWrapped(page: any, text: string, o: DrawOpts) {
  const lh = o.lineHeight ?? o.size * 1.4;
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
  return y;
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  const pre = handlePreflight(req);
  if (pre) return pre;

  const cl = Number(req.headers.get("content-length") || "0");
  // Allow up to 8MB — data URLs for images can be large
  if (cl > 8_388_608) return jsonResp({ error: "payload_too_large" }, 413, corsHeaders);

  const ip = clientIp(req);
  const rl = await checkRateLimits(`ip:${ip}`, "trial-pdf", [
    { windowSec: 60,    max: 3,  blockSec: 120  },
    { windowSec: 86400, max: 15, blockSec: 3600 },
  ]);
  if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

  try {
    const raw = (await req.json().catch(() => ({}))) as ReqBody;
    const title = typeof raw?.title === "string" ? raw.title.slice(0, 200) : "My Story";
    const pages = Array.isArray(raw?.pages) ? raw.pages.slice(0, 20) : [];
    if (pages.length === 0) return jsonResp({ error: "missing_pages" }, 400, corsHeaders);

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    // Cover
    const cover = pdf.addPage([595, 842]);
    cover.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(0.06, 0.08, 0.18) });
    drawWrapped(cover, title, {
      x: 60, y: 600, width: 475,
      font: fontBold, size: 34, color: rgb(1, 1, 1),
    });
    if (raw.selStatement) {
      drawWrapped(cover, raw.selStatement.slice(0, 300), {
        x: 60, y: 460, width: 475,
        font, size: 14, color: rgb(0.85, 0.88, 1),
      });
    }
    cover.drawText("Najmah — Starry Tales", {
      x: 60, y: 60, size: 12, font, color: rgb(0.7, 0.75, 0.95),
    });

    // Sort by index
    const sorted = [...pages].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

    for (const p of sorted) {
      const page = pdf.addPage([595, 842]);
      page.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(0.99, 0.98, 0.95) });

      let textY = 720;
      if (p.imageUrl) {
        const img = await fetchImageBytes(p.imageUrl);
        if (img) {
          try {
            const isPng = img.mime.includes("png");
            const embedded = isPng
              ? await pdf.embedPng(img.bytes)
              : await pdf.embedJpg(img.bytes);
            const maxW = 475, maxH = 360;
            const ratio = Math.min(maxW / embedded.width, maxH / embedded.height);
            const w = embedded.width * ratio;
            const h = embedded.height * ratio;
            page.drawImage(embedded, { x: (595 - w) / 2, y: 842 - 60 - h, width: w, height: h });
            textY = 842 - 60 - h - 30;
          } catch (e) {
            console.warn(`[trial-pdf] embed failed for page ${p.index}`, e instanceof Error ? e.message : e);
          }
        }
      }

      drawWrapped(page, p.text ?? "", {
        x: 60, y: textY, width: 475,
        font, size: 14, color: rgb(0.1, 0.1, 0.15), lineHeight: 20,
      });

      page.drawText(`Page ${p.index}`, { x: 60, y: 40, size: 10, font, color: rgb(0.4, 0.4, 0.5) });
      if (p.emotionTag) {
        const tag = p.emotionTag.toUpperCase().slice(0, 20);
        const tw = fontBold.widthOfTextAtSize(tag, 10);
        page.drawText(tag, { x: 595 - 60 - tw, y: 40, size: 10, font: fontBold, color: rgb(0.4, 0.3, 0.7) });
      }
    }

    const bytes = await pdf.save();
    // Base64 encode
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);

    console.log(`[trial-pdf] pdf rendered pages=${sorted.length} sizeKB=${Math.round(bytes.length / 1024)} ip=${ip}`);
    return jsonResp({
      pdfBase64: base64,
      mimeType: "application/pdf",
      pageCount: sorted.length + 1, // cover + pages
      sizeBytes: bytes.length,
    }, 200, corsHeaders);
  } catch (e) {
    console.error("[trial-pdf] error", e);
    return jsonResp({
      error: "pdf_failed",
      message: "Could not build PDF — please try again.",
    }, 500, corsHeaders);
  }
});
