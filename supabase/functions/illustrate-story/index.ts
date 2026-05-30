// illustrate-story — Phase 4. Generates one image per page using Lovable AI image
// model, ensuring character consistency via the visual hash from the planner.
// Persists each image to the public `story-images` bucket and the
// `generated_illustrations` table.

import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkRateLimits, rateLimitResponse } from "../_shared/rateLimit.ts";
import { loadUserAIContext, type UserImageKey } from "../_shared/userKeys.ts";

import { colorPaletteFor } from "../_shared/sel/visual.ts";

// Primary: User-supplied image API key (if present). Fallback: Lovable AI image
// model. Final fallback: Pollinations.ai (no key needed).
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const LOVABLE_IMAGE_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const IMAGE_MODELS = [
  "google/gemini-3.1-flash-image-preview",
  "google/gemini-2.5-flash-image",
];
const POLLINATIONS_BASE = "https://image.pollinations.ai/prompt";

type ImgOk = { ok: true; bytes: Uint8Array; mime: string; ext: string };
type ImgErr = { ok: false; status: number; body: string };

async function tryGenerate(prompt: string, seed: number, userImageKeys: UserImageKey[]): Promise<ImgOk | ImgErr> {
  // 1) User-supplied image providers first (so credits go on their account).
  for (const k of userImageKeys) {
    try {
      let r: ImgOk | ImgErr | null = null;
      if (k.provider === "openai") r = await tryOpenAIImage(prompt, k);
      else if (k.provider === "google") r = await tryGoogleImage(prompt, k);
      else if (k.provider === "stability") r = await tryStabilityImage(prompt, k);
      if (r && r.ok) return r;
      if (r) console.error(`[illustrate] user:${k.provider} failed status=${r.status} body=${r.body}`);
    } catch (e) {
      console.error(`[illustrate] user:${k.provider} threw`, e);
    }
  }

  // 2) Lovable AI image gateway
  if (LOVABLE_API_KEY) {
    const ai = await tryLovableImage(prompt);
    if (ai.ok) return ai;
    console.error(`[illustrate] lovable image failed status=${ai.status} body=${ai.body}`);
  }

  // 3) Pollinations.ai (no key)
  try {
    const url = `${POLLINATIONS_BASE}/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&safe=true&model=flux&seed=${seed}`;
    const r = await fetch(url);
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      console.error(`[illustrate] pollinations status=${r.status} body=${txt.slice(0, 300)}`);
      return { ok: false, status: r.status, body: txt.slice(0, 300) };
    }
    const buf = new Uint8Array(await r.arrayBuffer());
    const mime = r.headers.get("content-type") ?? "image/jpeg";
    const ext = mime.includes("png") ? "png" : "jpg";
    return { ok: true, bytes: buf, mime, ext };
  } catch (e) {
    return { ok: false, status: 0, body: e instanceof Error ? e.message : "unknown" };
  }
}

async function tryOpenAIImage(prompt: string, k: UserImageKey): Promise<ImgOk | ImgErr> {
  const url = (k.baseUrl?.replace(/\/$/, "") || "https://api.openai.com/v1") + "/images/generations";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 80_000);
  try {
    const r = await fetch(url, {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${k.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: k.model || "gpt-image-1",
        prompt,
        size: "1024x1024",
        n: 1,
        response_format: "b64_json",
      }),
    });
    if (!r.ok) return { ok: false, status: r.status, body: (await r.text().catch(() => "")).slice(0, 300) };
    const data = await r.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (typeof b64 !== "string") return { ok: false, status: 502, body: "missing_image_b64" };
    return base64ToBytes(b64, "image/png");
  } catch (e) {
    return { ok: false, status: 0, body: e instanceof Error ? e.message : "unknown" };
  } finally {
    clearTimeout(timer);
  }
}

async function tryGoogleImage(prompt: string, k: UserImageKey): Promise<ImgOk | ImgErr> {
  // Use the Gemini image-capable model via chat-completions compatibility endpoint.
  const url = (k.baseUrl?.replace(/\/$/, "") || "https://generativelanguage.googleapis.com/v1beta/openai") + "/chat/completions";
  const model = k.model || "gemini-2.5-flash-image";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 80_000);
  try {
    const r = await fetch(url, {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${k.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, modalities: ["image", "text"], messages: [{ role: "user", content: prompt }] }),
    });
    if (!r.ok) return { ok: false, status: r.status, body: (await r.text().catch(() => "")).slice(0, 300) };
    const data = await r.json();
    const dataUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
      return { ok: false, status: 502, body: "missing_image_data" };
    }
    return dataUrlToBytes(dataUrl);
  } catch (e) {
    return { ok: false, status: 0, body: e instanceof Error ? e.message : "unknown" };
  } finally {
    clearTimeout(timer);
  }
}

async function tryStabilityImage(prompt: string, k: UserImageKey): Promise<ImgOk | ImgErr> {
  const url = "https://api.stability.ai/v2beta/stable-image/generate/core";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 80_000);
  try {
    const form = new FormData();
    form.append("prompt", prompt);
    form.append("output_format", "png");
    const r = await fetch(url, {
      method: "POST",
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${k.apiKey}`, Accept: "image/*" },
      body: form,
    });
    if (!r.ok) return { ok: false, status: r.status, body: (await r.text().catch(() => "")).slice(0, 300) };
    const buf = new Uint8Array(await r.arrayBuffer());
    return { ok: true, bytes: buf, mime: "image/png", ext: "png" };
  } catch (e) {
    return { ok: false, status: 0, body: e instanceof Error ? e.message : "unknown" };
  } finally {
    clearTimeout(timer);
  }
}

function base64ToBytes(b64: string, mime: string): ImgOk {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  return { ok: true, bytes, mime, ext };
}

async function tryLovableImage(prompt: string): Promise<{ ok: true; bytes: Uint8Array; mime: string; ext: string } | { ok: false; status: number; body: string }> {
  let lastStatus = 500;
  let lastBody = "no_image";
  for (const model of IMAGE_MODELS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 80_000);
    try {
      const r = await fetch(LOVABLE_IMAGE_URL, {
        method: "POST",
        signal: ctrl.signal,
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, modalities: ["image", "text"], messages: [{ role: "user", content: prompt }] }),
      });
      clearTimeout(timer);
      if (!r.ok) {
        lastStatus = r.status;
        lastBody = (await r.text().catch(() => "")).slice(0, 300);
        continue;
      }
      const data = await r.json();
      const url = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (typeof url !== "string" || !url.startsWith("data:image/")) {
        lastStatus = 502;
        lastBody = "missing_image_data";
        continue;
      }
      return dataUrlToBytes(url);
    } catch (e) {
      clearTimeout(timer);
      lastStatus = 0;
      lastBody = e instanceof Error ? e.message : "unknown";
    }
  }
  return { ok: false, status: lastStatus, body: lastBody };
}

interface PageIn {
  index: number;
  illustrationPrompt: string;
  emotionTag: string;
}
interface ReqBody {
  storyId: string;
  pages: PageIn[];
  characterVisualHash: string;
  characterProfile?: Record<string, unknown> | null;
  style?: string;
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  const pre = handlePreflight(req);
  if (pre) return pre;

  // Body size guard (~64KB — pages array can carry prompts)
  const cl = Number(req.headers.get("content-length") || "0");
    if (cl > 65_536) return json({ error: "payload_too_large" }, 413, corsHeaders);

  try {
    const body = (await req.json().catch(() => ({}))) as ReqBody & { trigger?: string; triggerSource?: string };
    // Function B contract: illustration generation MUST be user-triggered.
    // Reject any unattributed call even if a client bug slips through.
    if (body?.trigger !== "user") {
      console.error("[illustrate-story] BLOCKED non-user trigger", { trigger: body?.trigger, source: body?.triggerSource });
      return json({ error: "trigger_required", message: "illustrate-story requires { trigger: 'user' }" }, 403, corsHeaders);
    }
    if (!body?.storyId || typeof body.storyId !== "string" || body.storyId.length > 64
        || !Array.isArray(body?.pages) || body.pages.length === 0 || body.pages.length > 20
        || !body?.characterVisualHash || typeof body.characterVisualHash !== "string") {
      return json({ error: "missing_or_invalid_fields" }, 400, corsHeaders);
    }
    const style = (typeof body.style === "string" ? body.style.slice(0, 200) : "") || "soft watercolor children's book illustration";

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return json({ error: "unauthorized" }, 401, corsHeaders);

    // Rate limit (illustration calls are very expensive: image gen × pages)
    // Check admin first — admins bypass rate limits during testing
    const adminCheck = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: isAdminEarly } = await adminCheck.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!isAdminEarly) {
      const rl = await checkRateLimits(`u:${userId}`, "illustrate-story", [
        { windowSec: 60, max: 3 },
        { windowSec: 3600, max: 40 },
        { windowSec: 86400, max: 100 },
      ]);
      if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);
    }

    // Server-side subscription gate (cannot be bypassed from client UI)
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: paidAllowed, error: gateErr } = await admin.rpc("has_paid_feature", {
      _user_id: userId,
      _feature: "illustrations",
    });
    const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (gateErr) {
      console.error("[illustrate] gate check failed", gateErr);
      return json({ error: "subscription_check_failed" }, 500, corsHeaders);
    }
    if (roleErr) console.error("[illustrate] admin gate check failed", roleErr);
    const allowed = !!paidAllowed || !!isAdmin;
    if (!allowed) {
      return json({ error: "subscription_required", feature: "illustrations", blocked: true }, 200, corsHeaders);
    }

    const results: { index: number; imageUrl: string | null; status: string; error?: string }[] = [];
    const characterLock = describeCharacter(body.characterVisualHash, body.characterProfile);

    // Load user-supplied image API keys (used first so credits go on their account)
    const userCtx = await loadUserAIContext(userId);
    const userImageKeys = userCtx.imageKeys;

    // Generate all pages in parallel to stay under the 150s edge idle timeout.
    // Sequential generation of 10+ images at ~15-30s each would always time out.
    const tasks = body.pages.map(async (page) => {
      const palette = colorPaletteFor(page.emotionTag);
      const prompt =
        `${style}, consistent picture-book series, same main child in every image. ` +
        `${characterLock} Scene: ${page.illustrationPrompt}. ` +
        `Color palette: ${palette}. Emotion: ${page.emotionTag}. ` +
        `Do not redesign the child, outfit, hair, skin tone, age, proportions, or signature item. ` +
        `Child-safe, no text in image, gentle composition, full scene, no logos, no watermark.`;

      try {
        const seed = stableSeed(`${body.characterVisualHash}|${page.index}`);
        const gen = await tryGenerate(prompt, seed, userImageKeys);
        if (!gen.ok) {
          console.error(`[illustrate] page ${page.index} pollinations failed status=${gen.status} body=${gen.body}`);
          await persist(supabase, body.storyId, userId, page, prompt, null, "failed", body.characterVisualHash, style);
          return { index: page.index, imageUrl: null, status: "failed", error: `pollinations:${gen.status}` };
        }
        const path = `${userId}/${body.storyId}/page-${page.index}.${gen.ext}`;
        const { error: upErr } = await admin.storage
          .from("story-images")
          .upload(path, gen.bytes, { contentType: gen.mime, upsert: true });
        if (upErr) {
          console.error(`[illustrate] upload page ${page.index} failed`, upErr);
          await persist(supabase, body.storyId, userId, page, prompt, null, "failed", body.characterVisualHash, style);
          return { index: page.index, imageUrl: null, status: "failed", error: "upload_failed" };
        }
        const { data: pub } = supabase.storage.from("story-images").getPublicUrl(path);
        const url = pub.publicUrl;
        await persist(supabase, body.storyId, userId, page, prompt, url, "ready", body.characterVisualHash, style);
        return { index: page.index, imageUrl: url, status: "ready" };
      } catch (e) {
        console.error(`[illustrate] page ${page.index} unexpected error`, e);
        return { index: page.index, imageUrl: null, status: "failed", error: e instanceof Error ? e.message : "unknown" };
      }
    });

    const settled = await Promise.all(tasks);
    results.push(...settled.sort((a, b) => a.index - b.index));

    return json({ storyId: body.storyId, illustrations: results }, 200, corsHeaders);
  } catch (e) {
    console.error("illustrate-story error", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500, corsHeaders);
  }
});

async function persist(
  supabase: ReturnType<typeof createClient>,
  storyId: string,
  userId: string,
  page: PageIn,
  prompt: string,
  imageUrl: string | null,
  status: string,
  hash: string,
  style: string,
) {
  await supabase.from("generated_illustrations").insert([{
    story_id: storyId,
    user_id: userId,
    page_index: page.index,
    prompt,
    image_url: imageUrl,
    status,
    character_profile_hash: hash,
    style,
  }]);
}

function json(obj: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function describeCharacter(hash: string, profile?: Record<string, unknown> | null): string {
  const parts = hash.split("|").filter(Boolean);
  const name = String(profile?.name ?? parts.find((p) => !p.includes(":")) ?? "the same child");
  const age = String(profile?.age ?? valueFromHash(parts, "age") ?? "child");
  const skinTone = String(profile?.skinTone ?? valueFromHash(parts, "skin") ?? "consistent skin tone");
  const hair = String(profile?.hair ?? valueFromHash(parts, "hair") ?? "consistent hair");
  const outfitColor = String(profile?.outfitColor ?? valueFromHash(parts, "outfit") ?? "consistent outfit colors");
  const signatureItem = String(profile?.signatureItem ?? valueFromHash(parts, "item") ?? "same signature item");
  const sense = profile?.sense ? ` Visual signature: ${String(profile.sense)}.` : "";
  return `LOCKED CHARACTER REFERENCE: ${name}, age ${age}, ${skinTone}, ${hair}, ${outfitColor}, always with ${signatureItem}.${sense} Raw consistency key: ${hash}.`;
}

function valueFromHash(parts: string[], key: string): string | undefined {
  return parts.find((p) => p.startsWith(`${key}:`))?.slice(key.length + 1);
}

function dataUrlToBytes(dataUrl: string): { ok: true; bytes: Uint8Array; mime: string; ext: string } {
  const match = dataUrl.match(/^data:(image\/(png|jpeg|jpg|webp));base64,(.+)$/);
  if (!match) throw new Error("invalid_image_data_url");
  const mime = match[1];
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const binary = atob(match[3]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { ok: true, bytes, mime, ext };
}

function stableSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 1_000_000;
}
