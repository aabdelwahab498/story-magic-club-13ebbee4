// AI Storyteller edge function — generates a multilingual story via Lovable AI Gateway
import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { checkRateLimits, identifierFromRequest, rateLimitResponse } from "../_shared/rateLimit.ts";
import { enforceStoryFairUse, quotaResponse, userIdFromRequest } from "../_shared/quota.ts";
import { moderateText, moderationRejectedResponse, ModerationGatewayError } from "../_shared/moderation.ts";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  ar: "Arabic",
  de: "German",
  fr: "French",
  it: "Italian",
  es: "Spanish",
};

// Word count target by length
const LENGTH_MAP: Record<string, string> = {
  short: "around 200 words",
  medium: "around 400 words",
  long: "around 800 words",
};

// Detailed creative direction per theme — gives the AI concrete vocabulary,
// settings and motifs so themes feel meaningfully different.
const THEME_GUIDE: Record<string, string> = {
  adventure:
    "An exciting quest with brave choices, hidden maps, mountain trails or secret caves, " +
    "small obstacles overcome with courage and teamwork. Use action verbs and surprise turns, " +
    "but keep all peril gentle and resolved kindly.",
  animals:
    "A heartwarming tale about animal friends in a forest, farm, jungle or savanna. " +
    "Give animals distinct voices and quirky habits. Include sounds (cheep, rustle, splash) " +
    "and a small lesson about friendship, kindness or sharing.",
  space:
    "A wondrous journey across stars, planets, comets and friendly aliens. Mention rockets, " +
    "moons, constellations and zero-gravity moments. Use cosmic imagery (twinkling, glowing, " +
    "shimmering) and end with a peaceful return home.",
  fantasy:
    "A magical story with wizards, fairies, dragons, enchanted forests or talking objects. " +
    "Include spells, glowing potions, riddles and a touch of whimsy. Magic should always be " +
    "used for kindness, never fear.",
  underwater:
    "A dreamy ocean adventure with coral reefs, dolphins, glowing jellyfish, sea turtles and " +
    "sunken treasure. Use flowing, watery language (drift, glide, ripple, sparkle) and " +
    "include bioluminescent wonders.",
};

// Age-band guidance — vocabulary level, sentence length, complexity, themes to avoid.
const AGE_GUIDE: Record<string, string> = {
  "3-5":
    "Use very simple words a 3–5 year old understands. Short sentences (5–8 words). " +
    "Lots of repetition, sound words and rhymes. One clear feeling per paragraph. " +
    "No scary moments, no complex emotions. Focus on colors, animals, hugs and bedtime calm.",
  "6-8":
    "Use everyday vocabulary with a few colorful new words explained naturally in context. " +
    "Sentences of 8–14 words. Introduce a small problem and a kind solution. " +
    "Add humor, friendship and small acts of bravery.",
  "9-12":
    "Use richer vocabulary and more descriptive imagery. Sentences can vary (10–20 words). " +
    "Include layered characters, mild challenges, curiosity and discovery. Avoid violence, " +
    "romance or anything frightening — keep it wholesome and bedtime-appropriate.",
};

import { aiChat, AIGatewayError } from "../_shared/sel/gateway.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
if (!GEMINI_API_KEY) {
  console.error("[generate-story] CRITICAL: GEMINI_API_KEY is not configured in environment variables.");
}

const ALLOWED_LANGS = new Set(Object.keys(LANGUAGE_NAMES));
const ALLOWED_LENGTHS = new Set(["short", "medium", "long"]);
const ALLOWED_AGES = new Set(["3-5", "6-8", "9-12"]);

const str = (v: unknown, max: number) =>
  typeof v === "string" ? v.slice(0, max).trim() : "";

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  const pre = handlePreflight(req);
  if (pre) return pre;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Body size guard (~16KB max)
  const cl = Number(req.headers.get("content-length") || "0");
  if (cl > 16_384) {
    return new Response(JSON.stringify({ error: "payload_too_large" }), {
      status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const raw = await req.json().catch(() => ({}));

    const character = str(raw.character, 80);
    const characterId = str(raw.characterId, 40);
    const theme = str(raw.theme, 80);
    const themeId = str(raw.themeId, 40);
    const ageRange = str(raw.ageRange, 20);
    const ageId = str(raw.ageId, 10);
    const length = str(raw.length, 10).toLowerCase();
    const customPrompt = str(raw.customPrompt, 500);
    const language = str(raw.language, 5).toLowerCase();

    if (!character || !theme || !ageRange) {
      return new Response(JSON.stringify({ error: "missing_required_fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (language && !ALLOWED_LANGS.has(language)) {
      return new Response(JSON.stringify({ error: "invalid_language" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (length && !ALLOWED_LENGTHS.has(length)) {
      return new Response(JSON.stringify({ error: "invalid_length" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (ageId && !ALLOWED_AGES.has(ageId)) {
      return new Response(JSON.stringify({ error: "invalid_age" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Server-side auth + quota + rate limit (cannot be bypassed from client)
    const userId = await userIdFromRequest(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const identifier = `u:${userId}`;
    const rl = await checkRateLimits(identifier, "generate-story", [
      { windowSec: 60, max: 3 },
      { windowSec: 3600, max: 15 },
      { windowSec: 86400, max: 50 },
    ]);
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);
    const quota = await enforceStoryFairUse(userId);
    if (!quota.allowed) return quotaResponse(quota, corsHeaders);

    // Lovable AI moderation on user-supplied free-text fields
    const toModerate = [character, theme, customPrompt].filter(Boolean).join("\n");
    if (toModerate.trim().length > 0) {
      try {
        const verdict = await moderateText(toModerate, { language });
        if (!verdict.allowed || verdict.severity === "medium" || verdict.severity === "high" || verdict.severity === "critical") {
          console.warn("[generate-story] moderation rejected", { userId, severity: verdict.severity, categories: verdict.categories });
          return moderationRejectedResponse(verdict, corsHeaders);
        }
      } catch (e) {
        if (e instanceof ModerationGatewayError) {
          return new Response(JSON.stringify({ error: "moderation_unavailable" }), {
            status: e.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const langName = LANGUAGE_NAMES[language] || "English";
    const wordTarget = LENGTH_MAP[length] || "around 300 words";
    const themeGuide = THEME_GUIDE[themeId] || "";
    const ageGuide = AGE_GUIDE[ageId] || "";

    // ===== Najmah AI — SEL / DAP / Trauma-Informed story generation prompt =====
    const systemPrompt = `You are Najmah AI, an expert educational storytelling assistant specializing in children's stories built on Social Emotional Learning (SEL), Developmentally Appropriate Practice (DAP), and Trauma-Informed Education.

You ALWAYS follow these non-negotiable standards:
- Write 100% in ${langName}. Never mix languages. Section headings below must also appear translated into ${langName} (keep the same order and meaning).
- Target ONE emotion only and ONE emotional skill only for the whole story.
- Follow the emotional arc strictly: Normal situation → Trigger event → Emotional escalation → Emotional regulation → Safe ending. Never skip a step.
- The child character must be realistic and imperfect (has a clear weakness and internal motivation).
- Include ONE supportive character who helps the child NAME feelings and regulate them — never lectures, never shames, never solves the problem for the child.
- Use very short sentences, positive language, age-appropriate vocabulary, and a warm calm tone.
- Absolutely avoid: violence, fear-based education, threats, punishment, shame, religious or political debate, long explanations, direct moral lessons.
- Teach through experience, normalize emotions, promote empathy, respect child autonomy, and end with emotional safety.
- The story body MUST be exactly 12 pages. Each page: Scene title, 1–2 short sentences, illustration description, and the child's emotion on that page.
- Before returning, silently run the Quality Checklist. If any item fails, regenerate the story internally until every item passes, then return only the final version.`;

    const userPrompt = `Generate a full Najmah AI story using this input:
- Storyteller / narrator character: ${character}
- Theme: ${theme}
- Target age: ${ageRange}
- Approximate reading length: ${wordTarget}
${customPrompt ? `- Parent's special request (must be honored safely): ${customPrompt}` : ""}

THEME DIRECTION (${theme}):
${themeGuide}

AGE-APPROPRIATE STYLE (${ageRange}):
${ageGuide}

Follow this workflow internally, then output the final structured story:

Step 1 — Educational Goal: pick child age, ONE target emotion (from: Anger, Fear, Sadness, Jealousy, Shame, Anxiety, Frustration, Confidence, Gratitude), ONE emotional skill, one learning outcome.
Step 2 — Character Design: realistic child with Name, Age, Gender, Personality, Strength, Weakness, Internal motivation, Environment. Not perfect.
Step 3 — Support Character: ONE (mother, father, friend, teacher, grandparent, imaginary friend, or animal). Helps identify feelings and regulate. Never lectures / shames / solves for the child.
Step 4 — Emotional Arc: Normal situation → Trigger event → Emotional escalation → Emotional regulation → Safe ending.
Step 5 — Story Structure: exactly 12 pages, each with Scene title, 1–2 short sentences, illustration description, child's emotion.
Step 6 — Language Rules: very short sentences, positive, age-appropriate, warm and calm. No violence/fear/threats/punishment/shame/long explanations.
Step 7 — Educational Rules: teach one skill, normalize emotions, healthy regulation, empathy, autonomy, emotional safety, no direct moral lesson.

Step 8 — OUTPUT FORMAT (return ONLY this, in ${langName}, in this exact order, using clear headings translated into ${langName}):

1. Story Title
2. Educational Goal
3. Target Emotion
4. Emotional Skill
5. Learning Outcome
6. Character Profile
7. Support Character
8. Story Outline
9. Story (12 Pages) — for each page:
   - Page N
   - Scene Title
   - Text (1–2 short sentences)
   - Illustration Prompt
   - Child's Emotion
10. Parent Guide — include: Story objective, What the child learns, Discussion questions, Practical activity, Tips for parents.
11. Quality Checklist — mark each with ✔:
   - SEL compliant
   - DAP compliant
   - Trauma-informed
   - Safe ending
   - Emotional regulation included
   - One emotion only
   - One emotional skill only
   - Child autonomy respected

Return plain readable text (no JSON, no markdown code fences). Everything in ${langName}.`;

    if (!GEMINI_API_KEY) {
      console.error("[generate-story] CRITICAL: GEMINI_API_KEY is not configured. AI call aborted.");
      return new Response(
        JSON.stringify({ error: "ai_config_missing", detail: "GEMINI_API_KEY is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let story = "";
    try {
      story = await aiChat({
        system: systemPrompt,
        user: userPrompt,
        maxTokens: 3000,
      });
      console.info(`[generate-story] succeeded via Gemini`);
    } catch (e) {
      if (e instanceof AIGatewayError) {
        console.error(`[generate-story] gemini failed: ${e.status} ${e.message}`);
        if (e.status === 429) {
          return new Response(JSON.stringify({ error: "rate_limited" }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (e.status === 402) {
          return new Response(
            JSON.stringify({
              error: "ai_provider_unavailable",
              reason: "upstream_capacity",
              message: "The AI provider is temporarily unavailable. Please try again shortly.",
            }),
            { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({ error: "ai_error", detail: e.message.slice(0, 200) }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw e;
    }

    return new Response(JSON.stringify({ story, language }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-story error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
