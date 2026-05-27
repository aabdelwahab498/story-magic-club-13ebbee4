// trial-illustrate — Generates images for the guest free-trial story.
// Anonymous (no auth). Uses Pollinations.ai (no AI credits) as primary to
// guarantee zero-cost guest experience, with Lovable AI as optional upgrade.
// Returns inline data URLs — no storage, no persistence.
//
// Always returns 200 with whatever images we managed to generate. Failed
// pages get imageUrl: null and the frontend renders a placeholder.

import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { checkRateLimits, rateLimitResponse } from "../_shared/rateLimit.ts";

const POLLINATIONS_BASE = "https://image.pollinations.ai/prompt";
const PER_IMAGE_TIMEOUT_MS = 25_000;
const MAX_PAGES = 6;

interface PageIn {
  index: number;
  illustrationPrompt: string;
  emotionTag?: string;
}

interface ReqBody {
  pages: PageIn[];
  childName?: string;
  theme?: string;
  style?: string;
}

function json(obj: unknown, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  return fwd.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
}

function stableSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 1_000_000;
}

async function tryPollinations(prompt: string, seed: number, useModel: boolean): Promise<string | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PER_IMAGE_TIMEOUT_MS);
  try {
    const modelPart = useModel ? "&model=flux" : "";
    const url = `${POLLINATIONS_BASE}/${encodeURIComponent(prompt)}?width=768&height=768&nologo=true&safe=true&seed=${seed}${modelPart}`;
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) {
      console.warn(`[trial-illustrate] pollinations ${r.status} (model=${useModel})`);
      return null;
    }
    const buf = new Uint8Array(await r.arrayBuffer());
    const mime = r.headers.get("content-type") ?? "image/jpeg";
    let binary = "";
    for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
    return `data:${mime};base64,${btoa(binary)}`;
  } catch (e) {
    clearTimeout(timer);
    console.warn(`[trial-illustrate] image error`, e instanceof Error ? e.message : e);
    return null;
  }
}

function placeholderSvg(emotion: string, index: number): string {
  const palette: Record<string, [string, string]> = {
    calm: ["#a7d8f5", "#fff7c2"],
    joy: ["#ffd166", "#ffb4a2"],
    sadness: ["#9bb1d6", "#d8e2f0"],
    fear: ["#b8a1d6", "#e6dcf2"],
    "fear-with-comfort": ["#c5a3e0", "#ffd7c2"],
    courage: ["#f4a261", "#e9c46a"],
  };
  const [a, b] = palette[emotion] || ["#bcd4e6", "#fce7c8"];
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 600'><defs><linearGradient id='g' x1='0' x2='1' y1='0' y2='1'><stop offset='0' stop-color='${a}'/><stop offset='1' stop-color='${b}'/></linearGradient></defs><rect width='600' height='600' fill='url(#g)'/><circle cx='480' cy='130' r='60' fill='#fff' opacity='.7'/><text x='50%' y='52%' font-family='serif' font-size='48' fill='#3a3a55' text-anchor='middle'>Scene ${index}</text><text x='50%' y='62%' font-family='sans-serif' font-size='22' fill='#3a3a55' text-anchor='middle' opacity='.7'>${emotion}</text></svg>`;
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

async function generateOne(prompt: string, shortPrompt: string, seed: number, emotion: string, index: number): Promise<{ url: string; status: "ready" | "failed" }> {
  let url = await tryPollinations(prompt, seed, true);
  if (!url) url = await tryPollinations(shortPrompt, seed, false);
  if (url) return { url, status: "ready" };
  return { url: placeholderSvg(emotion, index), status: "failed" };
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  const pre = handlePreflight(req);
  if (pre) return pre;

  const cl = Number(req.headers.get("content-length") || "0");
  if (cl > 32_768) return json({ error: "payload_too_large" }, 413, corsHeaders);

  const ip = clientIp(req);
  // Soft rate-limit — abuse only (image gen is heavier)
  const rl = await checkRateLimits(`ip:${ip}`, "trial-illustrate", [
    { windowSec: 60,    max: 3,  blockSec: 120  },
    { windowSec: 86400, max: 20, blockSec: 3600 },
  ]);
  if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

  try {
    const raw = (await req.json().catch(() => ({}))) as ReqBody;
    if (!Array.isArray(raw?.pages) || raw.pages.length === 0) {
      return json({ error: "missing_pages" }, 400, corsHeaders);
    }

    const pages = raw.pages.slice(0, MAX_PAGES).filter(
      (p) => typeof p?.index === "number" && typeof p?.illustrationPrompt === "string",
    );
    if (pages.length === 0) return json({ error: "missing_pages" }, 400, corsHeaders);

    const style = (typeof raw.style === "string" ? raw.style.slice(0, 200) : "") ||
      "soft watercolor children's book illustration, gentle pastel palette, warm lighting, full scene composition";
    const character = (typeof raw.childName === "string" ? raw.childName.slice(0, 60) : "") || "the same child";
    const theme = (typeof raw.theme === "string" ? raw.theme.slice(0, 80) : "") || "";

    // Generate in parallel — Pollinations handles concurrency fine.
    const tasks = pages.map(async (p) => {
      const prompt =
        `${style}. LOCKED CHARACTER: ${character} appears the same in every image (same face, outfit, hair, age). ` +
        (theme ? `Theme: ${theme}. ` : "") +
        `Scene: ${p.illustrationPrompt}. ` +
        (p.emotionTag ? `Emotion: ${p.emotionTag}. ` : "") +
        `Child-safe, no text in image, no logos, no watermark.`;
      const shortPrompt = `children book illustration, watercolor, ${character}, ${p.illustrationPrompt.slice(0, 140)}`;
      const seed = stableSeed(`${character}|${theme}|${p.index}`);
      const r = await generateOne(prompt, shortPrompt, seed, p.emotionTag || "calm", p.index);
      return { index: p.index, imageUrl: r.url, status: r.status };
    });

    const results = (await Promise.all(tasks)).sort((a, b) => a.index - b.index);
    const okCount = results.filter((r) => r.status === "ready").length;
    console.log(`[trial-illustrate] generated ${okCount}/${results.length} for ip=${ip}`);

    return json({ illustrations: results, total: results.length, ready: okCount }, 200, corsHeaders);
  } catch (e) {
    console.error("[trial-illustrate] error", e);
    // Graceful: never crash the guest — return empty illustrations
    return json({ illustrations: [], total: 0, ready: 0, error: "soft_fail" }, 200, corsHeaders);
  }
});
