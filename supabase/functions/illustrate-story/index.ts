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
import { consumeIllustrationCredits, refundIllustrationCredits, hasValidImageByok } from "../_shared/quota.ts";

const MAX_ILLUSTRATION_PAGES = 8;
const ILLUSTRATION_CREDIT_COST = 10;

import { colorPaletteFor } from "../_shared/sel/visual.ts";

// Primary: User-supplied image API key (if present). Fallback: Lovable AI image
// model. Final fallback: Pollinations.ai (no key needed).
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
// Native Lovable image generation endpoint (platform-managed, no external account).
const LOVABLE_IMAGE_URL = "https://ai.gateway.lovable.dev/v1/images/generations";
const IMAGE_MODELS = [
  "lovable/image-fast",
  "lovable/image-standard",
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
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, size: "1024x1024", n: 1 }),
        signal: ctrl.signal,
      });
      if (!r.ok) {
        lastStatus = r.status;
        lastBody = (await r.text().catch(() => "")).slice(0, 300);
        continue;
      }
      const data = await r.json();
      const item = data?.data?.[0];
      const b64 = item?.b64_json;
      if (typeof b64 === "string" && b64.length > 0) {
        const fmt = typeof data?.output_format === "string" ? data.output_format : "png";
        return base64ToBytes(b64, `image/${fmt === "jpeg" ? "jpeg" : fmt}`);
      }
      const url = item?.url;
      if (typeof url === "string" && url.startsWith("data:image/")) return dataUrlToBytes(url);
      if (typeof url === "string" && url.startsWith("http")) {
        const ir = await fetch(url, { signal: ctrl.signal });
        if (ir.ok) {
          const buf = new Uint8Array(await ir.arrayBuffer());
          const mime = ir.headers.get("content-type") ?? "image/png";
          return { ok: true, bytes: buf, mime, ext: mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg" };
        }
      }
      lastStatus = 502;
      lastBody = "missing_image_data";
    } catch (e) {
      lastStatus = 0;
      lastBody = e instanceof Error ? e.message : "unknown";
    } finally {
      clearTimeout(timer);
    }
  }

  return { ok: false, status: lastStatus, body: lastBody };
}


interface PageIn {
  index: number;
  illustrationPrompt: string;
  emotionTag: string;
  /** Canonical page text — used to derive the prompt when none was planned. */
  text?: string;
}
interface ReqBody {
  storyId: string;
  pages: PageIn[];
  characterVisualHash: string;
  characterProfile?: Record<string, unknown> | null;
  style?: string;
  idempotencyKey?: string;
}

// Idempotency cache lives in TWO tiers:
//   1) In-memory map (per warm instance) so concurrent duplicate requests
//      share a single in-flight Promise.
//   2) Postgres `illustration_job_cache` (durable across cold starts) so
//      retries that arrive after the worker recycles still dedup reliably.
const IDEMPOTENCY_TTL_MS = 5 * 60_000;
type CachedResult = { storyId: string; illustrations: { index: number; imageUrl: string | null; status: string; error?: string }[] };
type IdempotencyEntry = { expiresAt: number; promise: Promise<CachedResult> };
const idempotencyCache = new Map<string, IdempotencyEntry>();
function gcIdempotency() {
  const now = Date.now();
  for (const [k, v] of idempotencyCache) if (v.expiresAt < now) idempotencyCache.delete(k);
}

// Structured lifecycle logger. Mirrors the event into Postgres
// (illustration_job_events) so we can audit / build dashboards, and
// always emits a single-line JSON console.info so it's grep-friendly in
// the Edge Function logs view.
type LifecycleEvent =
  | "queued"
  | "complete"
  | "failed"
  | "idempotent_replay"
  | "idempotent_join"
  | "trigger_rejected";
async function logLifecycle(
  adminClient: ReturnType<typeof createClient>,
  args: {
    event: LifecycleEvent;
    storyId: string;
    userId?: string;
    idempotencyKey?: string | null;
    pageIndex?: number | null;
    status?: string | null;
    error?: string | null;
    latencyMs?: number | null;
    source?: string | null;
  },
) {
  const payload = { ts: Date.now(), source: "illustrate-story", ...args };
  console.info(`[illustrate-lifecycle] ${args.event}`, JSON.stringify(payload));
  try {
    await adminClient.from("illustration_job_events").insert([{
      event: args.event,
      story_id: args.storyId,
      user_id: args.userId ?? null,
      idempotency_key: args.idempotencyKey ?? null,
      page_index: args.pageIndex ?? null,
      status: args.status ?? null,
      error: args.error ?? null,
      latency_ms: args.latencyMs ?? null,
      source: args.source ?? null,
    }]);
  } catch (e) {
    // Logging must NEVER break the request.
    console.error("[illustrate-lifecycle] insert failed", e instanceof Error ? e.message : e);
  }
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
    const storyIdOk = typeof body?.storyId === "string" && body.storyId.length > 0 && body.storyId.length <= 64;
    // A page is valid when it carries an index plus SOME canonical content to
    // illustrate: either the planner's illustrationPrompt or the page text.
    const pagesOk = Array.isArray(body?.pages) && body.pages.length > 0 && body.pages.every((p) =>
      p && typeof p.index === "number"
      && ((typeof p.illustrationPrompt === "string" && p.illustrationPrompt.trim().length > 0)
        || (typeof p.text === "string" && p.text.trim().length > 0))
    );
    if (!storyIdOk || !pagesOk) {
      return json({
        error: "missing_or_invalid_fields",
        details: { storyId: storyIdOk ? "ok" : "missing_or_invalid", pages: pagesOk ? "ok" : "missing_page_content" },
      }, 400, corsHeaders);
    }
    // Character consistency data is OPTIONAL: when the canonical story has no
    // visual hash we derive a deterministic one from the story + character
    // context so every page of THIS story shares one locked reference.
    const suppliedHash = typeof (body as { characterVisualHash?: unknown }).characterVisualHash === "string"
      ? String(body.characterVisualHash).trim()
      : "";
    body.characterVisualHash = suppliedHash
      || `story:${body.storyId}|seed:${stableSeed(`${body.storyId}|${JSON.stringify(body.characterProfile ?? {})}`)}`;
    // Derive each page prompt from the ACTUAL canonical page content.
    body.pages = body.pages.map((p) => ({
      ...p,
      illustrationPrompt: (typeof p.illustrationPrompt === "string" && p.illustrationPrompt.trim())
        ? p.illustrationPrompt.trim().slice(0, 600)
        : String(p.text ?? "").trim().slice(0, 600),
      emotionTag: typeof p.emotionTag === "string" ? p.emotionTag : "",
    }));
    // Hard cap: max 8 illustrated pages per story (business model rule).
    if (body.pages.length > MAX_ILLUSTRATION_PAGES) {
      body.pages = body.pages.slice(0, MAX_ILLUSTRATION_PAGES);
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

    // Server-side credit gate. Admins bypass entirely.
    // Other users: try to debit 10 illustration credits. If insufficient,
    // pro_creator/elite_publisher with valid image-capable BYOK key may
    // continue using their own provider; everyone else is blocked.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });

    const characterLock = describeCharacter(body.characterVisualHash, body.characterProfile);

    // ----------------------------------------------------------------
    // REUSE GUARD: before spending credits, check whether the requested
    // pages already have a `ready` illustration persisted. If every
    // requested page is already ready, short-circuit (no credit charge).
    // If only some are ready, restrict generation to the missing pages.
    // ----------------------------------------------------------------
    const requestedIndices = body.pages.map((p) => p.index);
    const { data: existingRows } = await supabase
      .from("generated_illustrations")
      .select("page_index,image_url,status")
      .eq("story_id", body.storyId)
      .eq("user_id", userId)
      .in("page_index", requestedIndices);
    const readyMap = new Map<number, string>();
    for (const r of existingRows ?? []) {
      if (r.status === "ready" && typeof r.image_url === "string" && r.image_url) {
        readyMap.set(r.page_index as number, r.image_url as string);
      }
    }
    const missingPages = body.pages.filter((p) => !readyMap.has(p.index));
    if (missingPages.length === 0) {
      const reused = body.pages
        .map((p) => ({ index: p.index, imageUrl: readyMap.get(p.index)!, status: "ready" as const }))
        .sort((a, b) => a.index - b.index);
      await logLifecycle(admin, {
        event: "idempotent_replay",
        storyId: body.storyId,
        userId,
        idempotencyKey: body.idempotencyKey ?? null,
        source: body.triggerSource ?? null,
        error: "reused_existing_illustrations",
      });
      return json({ storyId: body.storyId, illustrations: reused, reused: true, source: "db_reuse" }, 200, corsHeaders);
    }

    // Credit gate (only fires when there's actual work to do).
    // Admins bypass. Other users: debit 10 credits; if insufficient,
    // pro_creator/elite_publisher with a valid image-capable BYOK key may
    // continue using their own provider; everyone else is blocked.
    let creditsCharged = false;
    let usingByok = false;
    if (!isAdmin) {
      const debit = await consumeIllustrationCredits(userId, ILLUSTRATION_CREDIT_COST);
      if (debit.success) {
        creditsCharged = true;
      } else {
        const byokOk = await hasValidImageByok(userId);
        if (!byokOk) {
          return json({
            error: "illustration_credits_exhausted",
            reason: "insufficient_credits",
            balance: debit.balance,
            cost: ILLUSTRATION_CREDIT_COST,
            message: "You don't have enough illustration credits. Upgrade your plan or add a personal image API key.",
          }, 402, corsHeaders);
        }
        usingByok = true;
      }
    }

    // Load user-supplied image API keys (used first so credits go on their account)
    const userCtx = await loadUserAIContext(userId);
    const userImageKeys = userCtx.imageKeys;
    void usingByok;


    const runGeneration = async () => {
      // Generate ONLY pages that don't already have a ready illustration.
      const tasks = missingPages.map(async (page) => {
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
      const generated = await Promise.all(tasks);
      // Merge reused (ready) pages with freshly generated ones.
      const reused = Array.from(readyMap.entries()).map(([index, imageUrl]) => ({
        index, imageUrl, status: "ready" as const,
      }));
      return {
        storyId: body.storyId,
        illustrations: [...reused, ...generated].sort((a, b) => a.index - b.index),
      };
    };


    // Server-side idempotency: collapse duplicate posts with the same key +
    // page set into one underlying job. In-flight calls await the same
    // Promise; recently-completed calls replay the cached result from the
    // durable `illustration_job_cache` row (survives cold starts).
    gcIdempotency();
    const pageSig = body.pages.map((p) => p.index).sort((a, b) => a - b).join(",");
    const cacheKey = body.idempotencyKey
      ? `u:${userId}|s:${body.storyId}|k:${body.idempotencyKey}|p:${pageSig}`
      : null;
    const t0 = Date.now();

    // (1) In-memory join: another concurrent invocation on this warm worker
    // is already running the job → await its Promise.
    if (cacheKey && idempotencyCache.has(cacheKey)) {
      const cached = await idempotencyCache.get(cacheKey)!.promise;
      await logLifecycle(admin, {
        event: "idempotent_join",
        storyId: body.storyId,
        userId,
        idempotencyKey: body.idempotencyKey,
        latencyMs: Date.now() - t0,
        source: body.triggerSource ?? null,
      });
      return json({ ...cached, idempotent: true, source: "memory" }, 200, corsHeaders);
    }

    // (2) Durable lookup in Postgres — covers cold starts and cross-instance
    // retries that the in-memory map can't see.
    if (cacheKey) {
      const { data: row } = await admin
        .from("illustration_job_cache")
        .select("result, expires_at")
        .eq("cache_key", cacheKey)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      if (row?.result) {
        const cached = row.result as CachedResult;
        await logLifecycle(admin, {
          event: "idempotent_replay",
          storyId: body.storyId,
          userId,
          idempotencyKey: body.idempotencyKey,
          latencyMs: Date.now() - t0,
          source: body.triggerSource ?? null,
        });
        return json({ ...cached, idempotent: true, source: "db" }, 200, corsHeaders);
      }
    }

    // (3) Fresh job — log queued, run, persist to both tiers.
    await logLifecycle(admin, {
      event: "queued",
      storyId: body.storyId,
      userId,
      idempotencyKey: body.idempotencyKey ?? null,
      source: body.triggerSource ?? null,
    });

    const promise = runGeneration();
    if (cacheKey) {
      idempotencyCache.set(cacheKey, { promise, expiresAt: Date.now() + IDEMPOTENCY_TTL_MS });
    }
    const payload = await promise;

    // Refund credits if every new page failed (user got nothing for their credits).
    if (creditsCharged) {
      const generatedPages = payload.illustrations.filter((r) =>
        missingPages.some((m) => m.index === r.index)
      );
      const allFailed = generatedPages.length > 0 && generatedPages.every((r) => r.status !== "ready");
      if (allFailed) {
        try {
          await refundIllustrationCredits(userId, ILLUSTRATION_CREDIT_COST);
          console.info("[illustrate] credits refunded after total failure", { userId, storyId: body.storyId });
        } catch (e) {
          console.error("[illustrate] refund failed", e instanceof Error ? e.message : e);
        }
      }
    }

    // Persist successful + failed results so duplicate retries land on the
    // same outcome instead of re-spending image-gen credits.
    if (cacheKey) {
      try {
        await admin.from("illustration_job_cache").upsert({
          cache_key: cacheKey,
          user_id: userId,
          story_id: body.storyId,
          idempotency_key: body.idempotencyKey!,
          page_signature: pageSig,
          result: payload,
          expires_at: new Date(Date.now() + IDEMPOTENCY_TTL_MS).toISOString(),
        }, { onConflict: "cache_key" });
      } catch (e) {
        console.error("[illustrate] cache upsert failed", e instanceof Error ? e.message : e);
      }
    }

    // Per-page lifecycle events (fire-and-forget — wrapped in Promise.all
    // so they don't block the response on a slow log write).
    await Promise.all(payload.illustrations.map((r) =>
      logLifecycle(admin, {
        event: r.status === "ready" ? "complete" : "failed",
        storyId: body.storyId,
        userId,
        idempotencyKey: body.idempotencyKey ?? null,
        pageIndex: r.index,
        status: r.status,
        error: r.error ?? null,
        latencyMs: Date.now() - t0,
        source: body.triggerSource ?? null,
      })
    ));

    return json(payload, 200, corsHeaders);


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
