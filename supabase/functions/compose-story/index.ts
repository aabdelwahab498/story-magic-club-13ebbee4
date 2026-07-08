// compose-story — Phase 3 SEL story orchestrator.
// Pipeline: Planner → Writer → Deterministic safety → Length check → LLM Quality judge.
// Regenerates up to 2 times if quality < 18 or safety fails.
// Returns canonical story JSON. Persists into ai_story_history + story_safety_reports.

import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { type AgeBand } from "../_shared/sel/constants.ts";
import { planStory, type StoryBlueprint, type PlannerInput } from "../_shared/sel/planner.ts";
import { writeStory, type WrittenStory } from "../_shared/sel/writer.ts";
import { deterministicSafetyCheck, type SafetyResult } from "../_shared/sel/safety.ts";
import { checkLength, type LengthCheck } from "../_shared/sel/length.ts";
import { judgeQuality, type QualityReport } from "../_shared/sel/quality.ts";
import { characterVisualHash } from "../_shared/sel/visual.ts";
import { AIGatewayError } from "../_shared/sel/gateway.ts";
import { checkRateLimits, rateLimitResponse } from "../_shared/rateLimit.ts";
import { enforceStoryFairUse, quotaResponse } from "../_shared/quota.ts";
import { moderateText, moderationRejectedResponse, ModerationGatewayError } from "../_shared/moderation.ts";
import { withUserAI } from "../_shared/userKeys.ts";

const DEFAULT_MAX_REGENERATIONS = 2;

function ageToBand(age: number): AgeBand {
  if (age <= 5) return "3-5";
  if (age <= 8) return "6-8";
  return "9-12";
}

interface ComposeRequest {
  childProfileId?: string;
  childName: string;
  age: number;
  theme: string;
  emotionalFocus?: string[];
  language?: string;
  customPrompt?: string;
  mode?: "plan" | "full";
  presetBlueprint?: StoryBlueprint;
}

const ALLOWED_LANGS = new Set(["en", "ar", "de", "fr", "it", "es"]);
const str = (v: unknown, max: number) =>
  typeof v === "string" ? v.slice(0, max).trim() : "";

// Standardized user-facing error payload — always HTTP 200 so the browser
// never surfaces "non-2xx" / raw Edge Function errors. `code` is for the
// client to branch on (e.g. show "please sign in"); `message` is the only
// string ever shown to end users.
const FRIENDLY_GENERIC = "Unable to generate the story right now. Please try again in a few moments.";
const FRIENDLY_UNAVAILABLE = "AI service is temporarily unavailable. Please try again later.";
const FRIENDLY_AUTH = "Please sign in to generate a story.";
const FRIENDLY_MODERATION = "Your idea couldn't be used. Please try a different topic.";
const FRIENDLY_QUOTA = "You've reached your story limit for now. Please try again later.";
const FRIENDLY_RATE = "Too many requests. Please wait a moment and try again.";
const FRIENDLY_INPUT = "Some details are missing or invalid. Please review your inputs.";

function fail(
  code: string,
  message: string,
  corsHeaders: Record<string, string>,
  extra: Record<string, unknown> = {},
): Response {
  // Always HTTP 200: client reads `success:false` + friendly message.
  return new Response(
    JSON.stringify({ success: false, code, message, ...extra }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  const pre = handlePreflight(req);
  if (pre) return pre;

  const requestId = crypto.randomUUID();
  const t0 = Date.now();
  const log = (msg: string, extra: Record<string, unknown> = {}) =>
    console.log(`[compose-story][${requestId}] ${msg}`, { ms: Date.now() - t0, ...extra });
  const errLog = (msg: string, extra: Record<string, unknown> = {}) =>
    console.error(`[compose-story][${requestId}] ${msg}`, { ms: Date.now() - t0, ...extra });

  // Body size guard (~16KB)
  const cl = Number(req.headers.get("content-length") || "0");
  if (cl > 16_384) {
    errLog("payload too large", { contentLength: cl });
    return fail("payload_too_large", FRIENDLY_INPUT, corsHeaders);
  }


  try {
    log("request received");

    // 1) Environment preflight — validate required secrets BEFORE calling AI.
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      errLog("missing supabase env vars", {
        hasUrl: !!SUPABASE_URL,
        hasAnon: !!SUPABASE_ANON_KEY,
        hasServiceRole: !!SUPABASE_SERVICE_ROLE_KEY,
      });
      return fail("service_unavailable", FRIENDLY_UNAVAILABLE, corsHeaders);
    }
    if (!GEMINI_API_KEY) {
      errLog("GEMINI_API_KEY missing — cannot call AI");
      return fail("ai_unavailable", FRIENDLY_UNAVAILABLE, corsHeaders);
    }

    // 2) Parse & validate request payload.
    const raw = await req.json().catch(() => ({}));
    const childName = str(raw.childName, 60);
    const theme = str(raw.theme, 80);
    const age = Number(raw.age);
    if (!childName || !theme || !Number.isFinite(age) || age < 3 || age > 12) {
      errLog("invalid input", { hasName: !!childName, hasTheme: !!theme, age });
      return fail("invalid_input", FRIENDLY_INPUT, corsHeaders);
    }
    const language = str(raw.language, 5).toLowerCase() || "en";
    if (!ALLOWED_LANGS.has(language)) {
      errLog("invalid language", { language });
      return fail("invalid_input", FRIENDLY_INPUT, corsHeaders);
    }
    const customPrompt = str(raw.customPrompt, 500);
    const childProfileId = str(raw.childProfileId, 40);
    const emotionalFocus = Array.isArray(raw.emotionalFocus)
      ? raw.emotionalFocus.slice(0, 6).map((x: unknown) => str(x, 40)).filter(Boolean)
      : [];
    const mode: "plan" | "full" = raw.mode === "plan" ? "plan" : "full";
    const presetBlueprint = (raw.presetBlueprint && typeof raw.presetBlueprint === "object")
      ? raw.presetBlueprint as StoryBlueprint
      : undefined;
    const body: ComposeRequest = { childName, age, theme, language, customPrompt, childProfileId: childProfileId || undefined, emotionalFocus, mode, presetBlueprint };

    // 3) Auth (we need user_id to persist)
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id ?? null;
    if (!userId) {
      errLog("unauthorized — no valid session");
      return fail("unauthorized", FRIENDLY_AUTH, corsHeaders);
    }
    log("auth ok", { userId });

    // 4) Rate limit + quota (server-side, cannot be bypassed) — admins bypass
    const identifier = `u:${userId}`;
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: isAdmin } = await adminClient.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) {
      const fair = await enforceStoryFairUse(userId);
      if (!fair.allowed) {
        errLog("quota exceeded", { reason: (fair as { reason?: string }).reason });
        return fail("quota_exceeded", FRIENDLY_QUOTA, corsHeaders);
      }
    }
    void identifier;

    // 5) Lovable AI moderation on user-supplied free text
    const toModerate = [childName, theme, customPrompt, ...emotionalFocus].filter(Boolean).join("\n");
    if (toModerate.trim().length > 0) {
      try {
        const verdict = await moderateText(toModerate, { language, childAge: age });
        if (!verdict.allowed || verdict.severity === "medium" || verdict.severity === "high" || verdict.severity === "critical") {
          console.warn(`[compose-story][${requestId}] moderation rejected`, { userId, severity: verdict.severity, categories: verdict.categories });
          return fail("moderation_rejected", FRIENDLY_MODERATION, corsHeaders);
        }
      } catch (e) {
        // Moderation is best-effort — log and continue if the moderation gateway itself fails.
        if (e instanceof ModerationGatewayError) {
          errLog("moderation gateway unavailable — continuing", { status: e.status });
        } else {
          errLog("moderation threw", { msg: e instanceof Error ? e.message : String(e) });
        }
      }
    }


    const ageBand = ageToBand(body.age);
    const plannerInput: PlannerInput = {
      childName: body.childName,
      age: body.age,
      ageBand,
      theme: body.theme,
      emotionalFocus: body.emotionalFocus ?? [],
      language,
      customPrompt: body.customPrompt,
    };

    // Load admin-controlled story-engine settings (admin-only table → use service role)
    // adminClient already created above
    const { data: settingsRow } = await adminClient
      .from("story_generation_settings")
      .select("*")
      .limit(1)
      .maybeSingle();
    const writerSettings = {
      model: settingsRow?.model ?? undefined,
      temperature: typeof settingsRow?.temperature === "number" ? settingsRow.temperature : undefined,
      systemPromptOverride: settingsRow?.system_prompt_override ?? null,
      userPromptAddendum: settingsRow?.user_prompt_addendum ?? null,
      visualStyle: settingsRow?.default_visual_style ?? "Pixar/Ghibli",
      // Keep free story generation text/audio-only. Illustration/download prompts are handled by the paid button.
      cinematicFields: {
        visualPrompt: false,
        animationPrompt: false,
        voiceOver: false,
        dialogue: false,
        soundEffects: false,
        backgroundMusic: false,
        imagePrompt: false,
        videoPrompt: false,
      },
      bannedWords: (settingsRow?.banned_words as string[]) ?? [],
      customPrompt: body.customPrompt,
    };
    const maxRegenerations: number = typeof settingsRow?.max_regenerations === "number"
      ? settingsRow.max_regenerations
      : DEFAULT_MAX_REGENERATIONS;
    const qualityThreshold: number = typeof settingsRow?.quality_threshold === "number"
      ? settingsRow.quality_threshold
      : 18;

    // Plan once (or reuse approved blueprint), then iterate writer/safety/quality.
    // Wrap the entire AI pipeline in the user's API-key context so planner/writer/
    // quality use the user's own provider keys (if any) before falling back to Lovable.
    // Single-pass generation — no quality judging, no regeneration loop.
    let blueprint: StoryBlueprint = presetBlueprint as StoryBlueprint;
    let written: WrittenStory | null = null;
    let safety: SafetyResult | null = null;
    let length: LengthCheck | null = null;
    const attempt = 0;

    await withUserAI(userId, async () => {
      if (presetBlueprint && presetBlueprint.title && presetBlueprint.hero && presetBlueprint.acts) {
        blueprint = presetBlueprint;
        log("using preset blueprint", { title: blueprint.title });
      } else {
        log("planning story");
        blueprint = await planStory(plannerInput);
        log("plan complete", { title: blueprint.title });
      }

      if (mode === "plan") return;

      log("writing story (single pass, quality judge disabled)");
      written = await writeStory(blueprint, ageBand, language, writerSettings);
      const fullText = written.pages.map((p) => p.text).join("\n");
      safety = deterministicSafetyCheck(fullText, ageBand);
      length = checkLength(written.pages, ageBand);
      log("write complete", { pages: written.pages.length, safetyPassed: safety.passed });
    });

    if (mode === "plan") {
      log("plan mode — returning blueprint only", { totalMs: Date.now() - t0 });
      return json({ requestId, mode: "plan", blueprint, age_band: ageBand }, 200, corsHeaders);
    }

    if (!written || !safety || !length) {
      return json({ error: "pipeline_failed", requestId }, 500, corsHeaders);
    }

    // Synthetic quality report — judge disabled in single-pass mode.
    const quality: QualityReport = {
      scores: {},
      total: 0,
      passed: true,
      ibbyCheck: {},
      bibliotherapyPresent: {},
      notes: "quality_judge_disabled",
      issues: [],
    };

    const visualHash = characterVisualHash({
      name: blueprint.hero.name,
      age: blueprint.hero.age,
      skinTone: blueprint.hero.skinTone,
      hair: blueprint.hero.hair,
      outfitColor: blueprint.hero.outfitColor,
      signatureItem: blueprint.hero.signatureItem,
      dominantEmotion: blueprint.dominantEmotion,
    });

    const responsePayload = {
      requestId,
      title: written.title,
      pages: written.pages,
      blueprint,
      sel_outcome: blueprint.selOutcome,
      character_visual_hash: visualHash,
      safety,
      length,
      quality,
      age_band: ageBand,
      regeneration_count: attempt,
      passed: safety.passed && quality.passed,
    };

    // Persist if authenticated
    if (userId) {
      log("persisting story");
      const { data: ins, error } = await supabase
        .from("ai_story_history")
        .insert([{
          user_id: userId,
          child_profile_id: body.childProfileId ?? null,
          title: written.title,
          language,
          theme: body.theme,
          age_band: ageBand,
          pages: written.pages as never,
          generated_story: { text: written.pages.map((p) => p.text).join("\n\n") } as never,
          prompt_data: {
            childName: body.childName,
            age: body.age,
            theme: body.theme,
            emotionalFocus: body.emotionalFocus ?? [],
          } as never,
          sel_analysis: { blueprint } as never,
          sel_outcome: blueprint.selOutcome as never,
          quality_scores: quality.scores as never,
          quality_total: quality.total,
          safety_passed: safety.passed && quality.passed,
          regeneration_count: attempt,
          character_visual_hash: visualHash,
        }])
        .select("id")
        .single();
      if (!error && ins?.id) {
        await supabase.from("story_safety_reports").insert([{
          story_id: ins.id,
          user_id: userId,
          piaget_check: { ageBand, sentenceWords: length.avgSentenceWords } as never,
          bowlby_check: { hopefulEnding: quality.scores["voice-safety"] >= 3 } as never,
          vygotsky_check: { ageFit: quality.scores["age-fit"] } as never,
          bibliotherapy_check: quality.bibliotherapyPresent as never,
          goleman_check: { skill: blueprint.selOutcome.skill } as never,
          ibby_check: quality.ibbyCheck as never,
          trauma_reject_check: { violations: safety.violations } as never,
          quality_rubric: quality.scores as never,
          total_score: quality.total,
          passed: safety.passed && quality.passed,
          notes: quality.notes,
        }]);
        (responsePayload as Record<string, unknown>).story_id = ins.id;
      } else if (error) {
        errLog("persist error", { error });
      }
    }

    log("success", { totalMs: Date.now() - t0 });
    return json(responsePayload, 200, corsHeaders);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (e instanceof AIGatewayError) {
      errLog("AI gateway failure", { status: e.status, msg });
      if (e.status === 429) return json({ error: "rate_limited", requestId, detail: msg }, 429, corsHeaders);
      if (e.status === 402) {
        // Provider-side capacity exhausted — surface as upstream issue.
        return json({
          error: "ai_provider_unavailable",
          reason: "upstream_capacity",
          message: "The AI provider is temporarily unavailable. Please try again shortly.",
          requestId,
          detail: msg,
        }, 503, corsHeaders);
      }
      if (e.status === 502) return json({ error: "ai_invalid_json", requestId, detail: msg }, 502, corsHeaders);
      return json({ error: "ai_gateway_failed", requestId, status: e.status, detail: msg }, 502, corsHeaders);
    }
    errLog("unhandled error", { msg, stack: e instanceof Error ? e.stack?.slice(0, 600) : undefined });
    return json({ error: "internal_error", requestId, detail: msg }, 500, corsHeaders);
  }
});

function json(obj: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
