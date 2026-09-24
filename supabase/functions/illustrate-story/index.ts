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

// Primary: platform-managed Lovable AI image model. User-supplied providers and
// Pollinations are fallbacks only for retryable upstream failures.
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
// Native Lovable image generation endpoint (platform-managed, no external account).
const LOVABLE_IMAGE_URL = "https://ai.gateway.lovable.dev/v1/images/generations";
const IMAGE_MODELS = ["openai/gpt-image-2.5-sunburst"];
const POLLINATIONS_BASE = "https://image.pollinations.ai/prompt";

type ImgOk = { ok: true; bytes: Uint8Array; mime: string; ext: string; provider: string; model: string };
type ImgErr = { ok: false; status: number; body: string; provider: string; model: string };

async function tryGenerate(prompt: string, seed: number, userImageKeys: UserImageKey[]): Promise<ImgOk | ImgErr> {
  // 1) Lovable AI image gateway — no external provider account is required.
  if (LOVABLE_API_KEY) {
    const ai = await tryLovableImage(prompt);
    if (ai.ok) return ai;
    console.error(`[illustrate] lovable image failed status=${ai.status} body=${ai.body}`);
    // Configuration, payment, policy, validation, and unavailable-model errors
    // are terminal. Never hide them by silently switching providers.
    if ([400, 401, 402, 403, 404].includes(ai.status)) return ai;
  }

  // 2) User-supplied image providers.
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

  // 3) Pollinations.ai (no key)
  try {
    const url = `${POLLINATIONS_BASE}/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&safe=true&model=flux&seed=${seed}`;
    const r = await fetch(url);
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      console.error(`[illustrate] pollinations status=${r.status} body=${txt.slice(0, 300)}`);
      return { ok: false, status: r.status, body: txt.slice(0, 300), provider: "pollinations", model: "flux" };
    }
    const buf = new Uint8Array(await r.arrayBuffer());
    const mime = r.headers.get("content-type") ?? "image/jpeg";
    const ext = mime.includes("png") ? "png" : "jpg";
    return { ok: true, bytes: buf, mime, ext, provider: "pollinations", model: "flux" };
  } catch (e) {
    return { ok: false, status: 0, body: e instanceof Error ? e.message : "unknown", provider: "pollinations", model: "flux" };
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
    if (!r.ok) return { ok: false, status: r.status, body: (await r.text().catch(() => "")).slice(0, 300), provider: "openai_byok", model: k.model || "gpt-image-1" };
    const data = await r.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (typeof b64 !== "string") return { ok: false, status: 502, body: "missing_image_b64", provider: "openai_byok", model: k.model || "gpt-image-1" };
    return { ...base64ToBytes(b64, "image/png"), provider: "openai_byok", model: k.model || "gpt-image-1" };
  } catch (e) {
    return { ok: false, status: 0, body: e instanceof Error ? e.message : "unknown", provider: "openai_byok", model: k.model || "gpt-image-1" };
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
    if (!r.ok) return { ok: false, status: r.status, body: (await r.text().catch(() => "")).slice(0, 300), provider: "google_byok", model };
    const data = await r.json();
    const dataUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
      return { ok: false, status: 502, body: "missing_image_data", provider: "google_byok", model };
    }
    return { ...dataUrlToBytes(dataUrl), provider: "google_byok", model };
  } catch (e) {
    return { ok: false, status: 0, body: e instanceof Error ? e.message : "unknown", provider: "google_byok", model };
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
    if (!r.ok) return { ok: false, status: r.status, body: (await r.text().catch(() => "")).slice(0, 300), provider: "stability_byok", model: k.model || "stable-image-core" };
    const buf = new Uint8Array(await r.arrayBuffer());
    return { ok: true, bytes: buf, mime: "image/png", ext: "png", provider: "stability_byok", model: k.model || "stable-image-core" };
  } catch (e) {
    return { ok: false, status: 0, body: e instanceof Error ? e.message : "unknown", provider: "stability_byok", model: k.model || "stable-image-core" };
  } finally {
    clearTimeout(timer);
  }
}

function base64ToBytes(b64: string, mime: string): Omit<ImgOk, "provider" | "model"> {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  return { ok: true, bytes, mime, ext };
}

async function tryLovableImage(prompt: string): Promise<ImgOk | ImgErr> {
  let lastStatus = 500;
  let lastBody = "no_image";
  for (const model of IMAGE_MODELS) {
    try {
      const r = await fetch(LOVABLE_IMAGE_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        // JPEG keeps each illustration around ~150KB instead of ~2.6MB PNG,
        // which keeps storage light and lets the PDF export embed every page
        // without exceeding the function memory budget.
        body: JSON.stringify({
          model,
          prompt,
          size: "1024x1024",
          quality: "low",
          output_format: "jpeg",
          stream: true,
          partial_images: 1,
        }),
      });
      if (!r.ok) {
        lastStatus = r.status;
        lastBody = (await r.text().catch(() => "")).slice(0, 300);
        continue;
      }
      const parsed = await readLovableImageStream(r);
      if (parsed.ok) return { ...parsed, provider: "lovable", model };
      if (parsed.status !== 204) return { ...parsed, provider: "lovable", model };

      // A stream with zero events may be replayed exactly once without
      // streaming. This is the only automatic replay in the image path.
      const replay = await fetch(LOVABLE_IMAGE_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, prompt, size: "1024x1024", quality: "low", output_format: "jpeg" }),
      });
      if (!replay.ok) {
        lastStatus = replay.status;
        lastBody = (await replay.text().catch(() => "")).slice(0, 300);
        continue;
      }
      const data = await replay.json();
      const b64 = data?.data?.[0]?.b64_json;
      if (typeof b64 === "string" && b64.length > 0) return { ...base64ToBytes(b64, "image/jpeg"), provider: "lovable", model };
      lastStatus = 502;
      lastBody = "missing_image_data";
    } catch (e) {
      lastStatus = 0;
      lastBody = e instanceof Error ? e.message : "unknown";
    }
  }

  return { ok: false, status: lastStatus, body: lastBody, provider: "lovable", model: IMAGE_MODELS[IMAGE_MODELS.length - 1] };
}

type StreamImgOk = Omit<ImgOk, "provider" | "model">;
type StreamImgErr = Omit<ImgErr, "provider" | "model">;
async function readLovableImageStream(response: Response): Promise<StreamImgOk | StreamImgErr> {
  if (!response.body) return { ok: false, status: 204, body: "empty_image_stream" };
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let sawEvent = false;
  let completedB64: string | null = null;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      buffer += chunk.value;
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const dataLine = frame.split("\n").find((line) => line.startsWith("data:"));
        if (!dataLine) continue;
        sawEvent = true;
        const raw = dataLine.slice(5).trim();
        if (!raw || raw === "[DONE]") continue;
        let payload: { type?: string; b64_json?: string; error?: { message?: string } };
        try { payload = JSON.parse(raw); } catch { continue; }
        if (payload.type === "error") {
          return { ok: false, status: 400, body: payload.error?.message ?? "image_generation_failed" };
        }
        if (payload.type === "image_generation.completed" && typeof payload.b64_json === "string") {
          completedB64 = payload.b64_json;
        }
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  if (completedB64) return base64ToBytes(completedB64, "image/jpeg");
  return sawEvent
    ? { ok: false, status: 502, body: "image_stream_ended_without_completion" }
    : { ok: false, status: 204, body: "empty_image_stream" };
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
  pages?: PageIn[];
  characterVisualHash?: string;
  characterProfile?: Record<string, unknown> | null;
  style?: string;
  idempotencyKey?: string;
  mode?: "generate" | "admin_recovery";
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
  | "trigger_rejected"
  | "provider_response"
  | "storage"
  | "persistence"
  | "credit";
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
    details?: Record<string, unknown>;
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
      details: args.details ?? {},
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

  let chargedUserId: string | null = null;
  let deliveredReadyImage = false;
  let refundCompleted = false;

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
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    const actorUserId = userData?.user?.id;
    if (!actorUserId) return json({ error: "unauthorized" }, 401, corsHeaders);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: actorUserId,
      _role: "admin",
    });

    const storyIdOk = typeof body?.storyId === "string" && body.storyId.length > 0 && body.storyId.length <= 64;
    if (!storyIdOk) return json({ error: "missing_or_invalid_story_id" }, 400, corsHeaders);

    const { data: storyRow, error: storyError } = await admin
      .from("ai_story_history")
      .select("id,user_id,child_profile_id,pages,generated_story,character_visual_hash,theme")
      .eq("id", body.storyId)
      .maybeSingle();
    if (storyError || !storyRow) return json({ error: "story_not_found" }, 404, corsHeaders);
    const storyOwnerId = String(storyRow.user_id);
    const isRecovery = body.mode === "admin_recovery";
    if (isRecovery && !isAdmin) return json({ error: "admin_required" }, 403, corsHeaders);
    if (!isRecovery && storyOwnerId !== actorUserId && !isAdmin) return json({ error: "story_forbidden" }, 403, corsHeaders);

    if (isRecovery) {
      body.triggerSource = "admin_diagnostics_recovery";
      const canonical = canonicalPages(storyRow.pages ?? storyRow.generated_story);
      body.pages = canonical;
      body.characterVisualHash = String(storyRow.character_visual_hash ?? "");
      body.style = typeof storyRow.theme === "string" && storyRow.theme ? storyRow.theme : body.style;
      if (storyRow.child_profile_id) {
        const { data: child } = await admin.from("child_profiles").select("name,age").eq("id", storyRow.child_profile_id).maybeSingle();
        if (child) body.characterProfile = { ...(body.characterProfile ?? {}), name: child.name, age: child.age };
      }
    }

    const pagesOk = Array.isArray(body.pages) && body.pages.length > 0 && body.pages.every((p) =>
      p && typeof p.index === "number"
      && ((typeof p.illustrationPrompt === "string" && p.illustrationPrompt.trim().length > 0)
        || (typeof p.text === "string" && p.text.trim().length > 0))
    );
    if (!pagesOk) return json({ error: "missing_or_invalid_fields", details: { pages: "missing_page_content" } }, 400, corsHeaders);

    const suppliedHash = typeof body.characterVisualHash === "string" ? body.characterVisualHash.trim() : "";
    body.characterVisualHash = suppliedHash
      || `story:${body.storyId}|seed:${stableSeed(`${body.storyId}|${JSON.stringify(body.characterProfile ?? {})}`)}`;
    body.pages = body.pages.map((p) => ({
      ...p,
      illustrationPrompt: (typeof p.illustrationPrompt === "string" && p.illustrationPrompt.trim())
        ? p.illustrationPrompt.trim().slice(0, 600)
        : String(p.text ?? "").trim().slice(0, 600),
      emotionTag: typeof p.emotionTag === "string" ? p.emotionTag : "",
    })).slice(0, MAX_ILLUSTRATION_PAGES);
    const pages = body.pages;
    const characterVisualHash = body.characterVisualHash;
    const style = (typeof body.style === "string" ? body.style.slice(0, 200) : "") || "soft watercolor children's book illustration";
    const userId = storyOwnerId;

    // Rate limit (illustration calls are very expensive: image gen × pages)
    // Check admin first — admins bypass rate limits during testing
    const priorChargedBatch = isRecovery
      ? await hasPriorSuccessfulCharge(admin, body.storyId, userId)
      : false;
    if (!isAdmin && !priorChargedBatch) {
      const rl = await checkRateLimits(`u:${actorUserId}`, "illustrate-story", [
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
    const characterLock = describeCharacter(characterVisualHash, body.characterProfile);

    // ----------------------------------------------------------------
    // REUSE GUARD: before spending credits, check whether the requested
    // pages already have a `ready` illustration persisted. If every
    // requested page is already ready, short-circuit (no credit charge).
    // If only some are ready, restrict generation to the missing pages.
    // ----------------------------------------------------------------
    const requestedIndices = pages.map((p) => p.index);
    const { data: existingRows } = await admin
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
    const missingPages = pages.filter((p) => !readyMap.has(p.index));
    if (missingPages.length === 0) {
      const reused = pages
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
    if (!isAdmin && !priorChargedBatch) {
      const debit = await consumeIllustrationCredits(userId, ILLUSTRATION_CREDIT_COST);
      if (debit.success) {
        creditsCharged = true;
        chargedUserId = userId;
        await logLifecycle(admin, { event: "credit", storyId: body.storyId, userId, idempotencyKey: body.idempotencyKey ?? null, status: "charged", source: body.triggerSource ?? null, details: { amount: ILLUSTRATION_CREDIT_COST, balance: debit.balance } });
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
        await logLifecycle(admin, { event: "credit", storyId: body.storyId, userId, idempotencyKey: body.idempotencyKey ?? null, status: "byok", source: body.triggerSource ?? null, details: { amount: 0 } });
      }
    } else {
      await logLifecycle(admin, {
        event: "credit", storyId: body.storyId, userId, idempotencyKey: body.idempotencyKey ?? null,
        status: isAdmin ? "admin_bypass" : "recovery_no_charge", source: body.triggerSource ?? null,
        details: { amount: 0, actorUserId, priorChargedBatch },
      });
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
          const seed = stableSeed(`${characterVisualHash}|${page.index}`);
          const gen = await tryGenerate(prompt, seed, userImageKeys);
          await logLifecycle(admin, {
            event: "provider_response", storyId: body.storyId, userId,
            idempotencyKey: body.idempotencyKey ?? null, pageIndex: page.index,
            status: gen.ok ? "success" : "failed", source: body.triggerSource ?? null,
            details: { provider: gen.provider, model: gen.model, httpStatus: gen.ok ? 200 : gen.status },
            error: gen.ok ? null : gen.body,
          });
          if (!gen.ok) {
            console.error(`[illustrate] page ${page.index} provider failed status=${gen.status} body=${gen.body}`);
            const persisted = await persist(admin, body.storyId, userId, page, prompt, null, "failed", characterVisualHash, style);
            await logLifecycle(admin, { event: "persistence", storyId: body.storyId, userId, idempotencyKey: body.idempotencyKey ?? null, pageIndex: page.index, status: persisted.ok ? "failed_recorded" : "failed", error: persisted.error ?? null, source: body.triggerSource ?? null, details: { table: "generated_illustrations" } });
            return { index: page.index, imageUrl: null, status: "failed", error: `${gen.provider}:${gen.status}` };
          }
          const path = `${userId}/${body.storyId}/page-${page.index}.${gen.ext}`;
          const { error: upErr } = await admin.storage
            .from("story-images")
            .upload(path, gen.bytes, { contentType: gen.mime, upsert: true });
          if (upErr) {
            console.error(`[illustrate] upload page ${page.index} failed`, upErr);
            await logLifecycle(admin, { event: "storage", storyId: body.storyId, userId, idempotencyKey: body.idempotencyKey ?? null, pageIndex: page.index, status: "failed", error: upErr.message, source: body.triggerSource ?? null, details: { bucket: "story-images", path, contentType: gen.mime } });
            await persist(admin, body.storyId, userId, page, prompt, null, "failed", characterVisualHash, style);
            return { index: page.index, imageUrl: null, status: "failed", error: "upload_failed" };
          }
          await logLifecycle(admin, { event: "storage", storyId: body.storyId, userId, idempotencyKey: body.idempotencyKey ?? null, pageIndex: page.index, status: "uploaded", source: body.triggerSource ?? null, details: { bucket: "story-images", path, contentType: gen.mime, bytes: gen.bytes.length } });
          const { data: pub } = supabase.storage.from("story-images").getPublicUrl(path);
          const url = pub.publicUrl;
          const persisted = await persist(admin, body.storyId, userId, page, prompt, url, "ready", characterVisualHash, style);
          await logLifecycle(admin, { event: "persistence", storyId: body.storyId, userId, idempotencyKey: body.idempotencyKey ?? null, pageIndex: page.index, status: persisted.ok ? "saved" : "failed", error: persisted.error ?? null, source: body.triggerSource ?? null, details: { table: "generated_illustrations", storagePath: path } });
          if (!persisted.ok) return { index: page.index, imageUrl: null, status: "failed", error: "persistence_failed" };
          return { index: page.index, imageUrl: url, status: "ready", provider: gen.provider, storagePath: path };
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
    const pageSig = pages.map((p) => p.index).sort((a, b) => a - b).join(",");
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
    deliveredReadyImage = payload.illustrations.some((r) => r.status === "ready" && !!r.imageUrl);

    // Refund credits if every new page failed (user got nothing for their credits).
    if (creditsCharged) {
      const generatedPages = payload.illustrations.filter((r) =>
        missingPages.some((m) => m.index === r.index)
      );
      const allFailed = generatedPages.length > 0 && generatedPages.every((r) => r.status !== "ready");
      if (allFailed) {
        try {
          await refundIllustrationCredits(userId, ILLUSTRATION_CREDIT_COST);
          refundCompleted = true;
          await logLifecycle(admin, { event: "credit", storyId: body.storyId, userId, idempotencyKey: body.idempotencyKey ?? null, status: "refunded", source: body.triggerSource ?? null, details: { amount: ILLUSTRATION_CREDIT_COST, reason: "total_failure" } });
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

    return json({ ...payload, recovery: isRecovery, repairedPages: missingPages.map((p) => p.index) }, 200, corsHeaders);


  } catch (e) {
    console.error("illustrate-story error", e);
    // Covers failures after debit but before a normal payload exists (cache,
    // storage, or orchestration exceptions). Never charge a zero-image run.
    if (chargedUserId && !deliveredReadyImage && !refundCompleted) {
      try {
        await refundIllustrationCredits(chargedUserId, ILLUSTRATION_CREDIT_COST);
        refundCompleted = true;
        console.info("[illustrate] credits refunded after aborted total failure", { userId: chargedUserId });
      } catch (refundError) {
        console.error("[illustrate] emergency refund failed", refundError instanceof Error ? refundError.message : refundError);
      }
    }
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
  const { error } = await supabase.from("generated_illustrations").upsert({
    story_id: storyId,
    user_id: userId,
    page_index: page.index,
    prompt,
    image_url: imageUrl,
    status,
    character_profile_hash: hash,
    style,
  }, { onConflict: "story_id,page_index" });
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}

function canonicalPages(raw: unknown): PageIn[] {
  const source = raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as { pages?: unknown }).pages
    : raw;
  if (!Array.isArray(source)) return [];
  return source.map((item, position) => {
    const page = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const index = Number(page.pageNumber ?? page.index ?? position + 1);
    const text = String(page.text ?? page.content ?? "").trim();
    return {
      index: Number.isFinite(index) ? index : position + 1,
      illustrationPrompt: String(page.illustrationPrompt ?? text).trim().slice(0, 600),
      emotionTag: String(page.emotionTag ?? page.emotion ?? "gentle").slice(0, 80),
      text,
    };
  }).filter((page) => page.illustrationPrompt.length > 0).slice(0, MAX_ILLUSTRATION_PAGES);
}

async function hasPriorSuccessfulCharge(
  admin: ReturnType<typeof createClient>,
  storyId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("illustration_job_events")
    .select("id")
    .eq("story_id", storyId)
    .eq("user_id", userId)
    .eq("event", "credit")
    .eq("status", "charged")
    .limit(1);
  return (data?.length ?? 0) > 0;
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
