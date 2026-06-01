// trial-story — Anonymous Free-Trial story preview (Production-safe).
//
// Guarantees:
//   • ALWAYS returns 200 with a usable story (uses local fallback if every
//     AI provider fails / is out of credits / times out).
//   • Never exposes provider errors to the client.
//   • Logs every attempt to `trial_usage` (provider, model, error_code,
//     latency_ms, fallback_used, stage).
//   • Soft IP rate-limit for abuse only (5/min, 30/day).
//
// The only non-200 responses are:
//   • 413 payload too large
//   • 429 rate-limit / abuse block
//   • 400 invalid input (childName/age/theme missing)
// All AI/provider failures degrade to a local fallback and still return 200.

import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { planStory } from "../_shared/sel/planner.ts";
import { writeStory } from "../_shared/sel/writer.ts";
import { moderateText } from "../_shared/moderation.ts";
import { checkRateLimits, rateLimitResponse } from "../_shared/rateLimit.ts";
import { localBlueprint, localStory } from "../_shared/sel/localFallback.ts";

const ALLOWED_LANGS = new Set(["en", "ar", "de", "fr", "it", "es"]);
const TRIAL_PAGES = 3;

const str = (v: unknown, max: number) =>
  typeof v === "string" ? v.slice(0, max).trim() : "";

function ageToBand(age: number): "3-5" | "6-8" | "9-12" {
  if (age <= 5) return "3-5";
  if (age <= 8) return "6-8";
  return "9-12";
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

// Classify a thrown error from gateway → short code for logs.
function classifyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const m = msg.match(/\b(402|429|401|403|404|500|502|503|504)\b/);
  if (m) return `http_${m[1]}`;
  if (/abort|timeout/i.test(msg)) return "timeout";
  if (/network|fetch/i.test(msg)) return "network";
  if (/json|parse/i.test(msg)) return "parse_error";
  return "unknown";
}

serve(async (req) => {
  try {
    return await handle(req);
  } catch (e) {
    console.error("[trial-story] CRITICAL unhandled, returning local story", e);
    const corsHeaders = buildCorsHeaders(req);
    // last-resort local story so the user never sees a crash
    const safe = localStory({ childName: "Hero", age: 6, ageBand: "6-8", theme: "adventure", language: "en" });
    return new Response(JSON.stringify({
      requestId: crypto.randomUUID(),
      teaser: true,
      title: safe.title,
      pages: safe.pages.slice(0, 3).map(p => ({
        index: p.index, text: p.text, emotionTag: p.emotionTag,
        illustrationPrompt: p.illustrationPrompt, imageUrl: null,
      })),
      totalPages: safe.pages.length,
      shownPages: Math.min(3, safe.pages.length),
      fallbackUsed: true,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

async function handle(req: Request): Promise<Response> {
  const corsHeaders = buildCorsHeaders(req);
  const pre = handlePreflight(req);
  if (pre) return pre;

  const requestId = crypto.randomUUID();
  const t0 = Date.now();
  const log = (msg: string, extra: Record<string, unknown> = {}) =>
    console.log(`[trial-story][${requestId}] ${msg}`, { ms: Date.now() - t0, ...extra });
  const fail = (msg: string, extra: Record<string, unknown> = {}) =>
    console.error(`[trial-story][${requestId}] ${msg}`, { ms: Date.now() - t0, ...extra });

  // Body guard — allow up to ~1000-word custom prompt
  const cl = Number(req.headers.get("content-length") || "0");
  if (cl > 16_384) {
    return json({ error: "payload_too_large", message: "Request too large." }, 413, corsHeaders);
  }

  const ip = clientIp(req);
  const ua = (req.headers.get("user-agent") ?? "").slice(0, 300);

  // Soft IP rate limit (abuse protection only)
  const rl = await checkRateLimits(`ip:${ip}`, "trial-story", [
    { windowSec: 60,    max: 5,  blockSec: 120  },
    { windowSec: 86400, max: 30, blockSec: 3600 },
  ]);
  if (!rl.allowed) {
    fail("rate_limited", { ip, reason: rl.reason, retryAfter: rl.retryAfter });
    return rateLimitResponse(rl, corsHeaders);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Unified logging helper: best-effort, never throws.
  const logEvent = async (row: {
    stage: string;
    childName?: string;
    theme?: string;
    provider?: string;
    model?: string;
    errorCode?: string | null;
    fallbackUsed?: boolean;
    pagesCount?: number;
    fingerprint?: string;
  }) => {
    try {
      await admin.from("trial_usage").insert([{
        fingerprint: row.fingerprint ?? `req:${requestId}`,
        ip,
        user_agent: ua,
        child_name: row.childName ?? null,
        theme: (row.theme ?? "").slice(0, 240),
        story_id: requestId,
        pages_count: row.pagesCount ?? 0,
        provider: row.provider ?? null,
        model: row.model ?? null,
        error_code: row.errorCode ?? null,
        latency_ms: Date.now() - t0,
        fallback_used: !!row.fallbackUsed,
        stage: row.stage,
      }]);
    } catch (e) {
      console.warn(`[trial-story][${requestId}] log insert failed`, e);
    }
  };

  // Parse + validate
  let childName = "";
  let theme = "";
  let age = NaN;
  let language = "ar";
  let customPrompt = "";
  let effectiveFingerprint = `req:${requestId}`;

  try {
    const raw = await req.json().catch(() => ({}));
    childName = str(raw.childName, 60);
    theme = str(raw.theme, 80);
    age = Number(raw.age);
    customPrompt = str(raw.customPrompt, 8000); // ~1000 words
    const fingerprint = str(raw.fingerprint, 128);
    language = (str(raw.language, 5).toLowerCase() || "ar");

    if (!childName || !theme || !Number.isFinite(age) || age < 3 || age > 12) {
      await logEvent({ stage: "validation_failed", errorCode: "invalid_input" });
      return json({
        error: "missing_or_invalid_fields",
        message: "اكتب اسم الطفل وموضوع القصة وعمر صحيح (3-12).",
      }, 400, corsHeaders);
    }
    effectiveFingerprint = fingerprint && fingerprint.length >= 8 ? fingerprint : `ipfp:${ip}`;
    if (!ALLOWED_LANGS.has(language)) language = "en";
  } catch (e) {
    fail("body_parse_failed", { error: e instanceof Error ? e.message : String(e) });
    await logEvent({ stage: "validation_failed", errorCode: "bad_json" });
    return json({
      error: "missing_or_invalid_fields",
      message: "Invalid request.",
    }, 400, corsHeaders);
  }

  const ageBand = ageToBand(age);
  const localInput = { childName, age, ageBand, theme, language };

  // ── Moderation (always soft-fail; never blocks the trial)
  try {
    const verdict = await moderateText([childName, theme].join("\n"), { language, childAge: age });
    if (!verdict.allowed || verdict.severity === "high" || verdict.severity === "critical") {
      await logEvent({
        stage: "moderation_rejected",
        childName, theme,
        errorCode: `rejected_${verdict.severity}`,
        fingerprint: effectiveFingerprint,
      });
      return json({
        error: "content_rejected",
        message: "المحتوى مش مناسب للأطفال — جرّب موضوع تاني.",
      }, 400, corsHeaders);
    }
  } catch (modErr) {
    // soft-fail: continue
    log("moderation_soft_fail", { error: modErr instanceof Error ? modErr.message : String(modErr) });
    await logEvent({
      stage: "moderation_soft_fail",
      childName, theme,
      errorCode: classifyError(modErr),
      fingerprint: effectiveFingerprint,
    });
  }

  // ── Phase 1: plan (AI → local fallback)
  let blueprint;
  let fallbackUsed = false;
  log("planning");
  try {
    blueprint = await planStory({
      childName, age, ageBand, theme,
      emotionalFocus: [], language,
      customPrompt: customPrompt || undefined,
    });
    log("plan_ok", { title: blueprint.title });
  } catch (planErr) {
    const code = classifyError(planErr);
    fail("planner_failed_using_fallback", { error: planErr instanceof Error ? planErr.message : String(planErr), code });
    await logEvent({
      stage: "planner_failed",
      childName, theme,
      provider: "lovable", model: "auto",
      errorCode: code, fallbackUsed: true,
      fingerprint: effectiveFingerprint,
    });
    blueprint = localBlueprint(localInput);
    fallbackUsed = true;
  }

  // ── Phase 2: write (AI → local fallback)
  let written;
  if (!fallbackUsed) {
    log("writing");
    try {
      written = await writeStory(blueprint, ageBand, language, {
        visualStyle: "Pixar/Ghibli",
        customPrompt: customPrompt || undefined,
        cinematicFields: {
          visualPrompt: false, animationPrompt: false, voiceOver: false,
          dialogue: false, soundEffects: false, backgroundMusic: false,
          imagePrompt: false, videoPrompt: false,
        },
      });
    } catch (writeErr) {
      const code = classifyError(writeErr);
      fail("writer_failed_using_fallback", { error: writeErr instanceof Error ? writeErr.message : String(writeErr), code });
      await logEvent({
        stage: "writer_failed",
        childName, theme,
        provider: "lovable", model: "auto",
        errorCode: code, fallbackUsed: true,
        fingerprint: effectiveFingerprint,
      });
      written = localStory(localInput);
      fallbackUsed = true;
    }
  } else {
    // Planner already fell back — use local writer too.
    written = localStory(localInput);
  }

  // Safety net: written must have pages
  if (!written?.pages?.length) {
    written = localStory(localInput);
    fallbackUsed = true;
  }

  const teaserPages = written.pages.slice(0, TRIAL_PAGES).map((p) => ({
    index: p.index,
    text: p.text,
    emotionTag: p.emotionTag,
    illustrationPrompt: p.illustrationPrompt,
    imageUrl: null as string | null,
  }));
  log("delivered", { totalPages: written.pages.length, teaser: teaserPages.length, fallbackUsed });

  await logEvent({
    stage: fallbackUsed ? "success_fallback" : "success",
    childName, theme,
    pagesCount: teaserPages.length,
    fallbackUsed,
    fingerprint: effectiveFingerprint,
    provider: fallbackUsed ? "local" : "lovable",
    model: fallbackUsed ? "local-template" : "auto",
  });

  return json({
    requestId,
    teaser: true,
    title: written.title,
    pages: teaserPages,
    totalPages: written.pages.length,
    shownPages: teaserPages.length,
    sel_outcome: blueprint.selOutcome,
    fallbackUsed,
  }, 200, corsHeaders);
}
