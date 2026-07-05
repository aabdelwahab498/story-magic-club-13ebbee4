// narrate-story-full: generates per-page TTS for a saved AI story, stitches
// audio into a single MP3, uploads to the story-audio bucket, and updates
// ai_story_history.audio_url. Uses Google Cloud TTS via the shared TTS module.
import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkRateLimits, rateLimitResponse } from "../_shared/rateLimit.ts";
import { synthesizeSpeech } from "../_shared/tts.ts";

interface Page {
  text: string;
  image_url?: string | null;
}

function extractText(page: unknown): string {
  if (typeof page === "string") return page;
  if (!page || typeof page !== "object") return "";
  const p = page as Record<string, unknown>;
  return String(p.text || p.content || p.narration || "").trim();
}

function extractImage(page: unknown): string | null {
  if (!page || typeof page !== "object") return null;
  const p = page as Record<string, unknown>;
  return (p.image_url as string) || (p.image as string) || null;
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  const pre = handlePreflight(req);
  if (pre) return pre;

  try {
    const { storyId, character = "" } = await req.json();
    if (!storyId || typeof storyId !== "string") {
      return new Response(JSON.stringify({ error: "storyId_required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Deno.env.get("GOOGLE_CLOUD_TTS_API_KEY")) {
      return new Response(JSON.stringify({ error: "tts_not_configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rl = await checkRateLimits(`u:${userId}`, "narrate-story-full", [
      { windowSec: 3600, max: 5 },
      { windowSec: 86400, max: 20 },
    ]);
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: paid } = await admin.rpc("has_paid_feature", {
      _user_id: userId, _feature: "audio",
    });
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userId, _role: "admin",
    });
    if (!paid && !isAdmin) {
      return new Response(
        JSON.stringify({ error: "subscription_required", feature: "audio" }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: story, error: e1 } = await admin
      .from("ai_story_history")
      .select("id,user_id,pages,generated_story,language,audio_url")
      .eq("id", storyId)
      .maybeSingle();
    if (e1 || !story) {
      return new Response(JSON.stringify({ error: "story_not_found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (story.user_id !== userId && !isAdmin) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawPages = Array.isArray(story.pages) ? story.pages : [];
    let pages: Page[] = rawPages
      .map((p) => ({ text: extractText(p), image_url: extractImage(p) }))
      .filter((p) => p.text.length > 0)
      .slice(0, 20);

    if (pages.length === 0) {
      const gs = story.generated_story as Record<string, unknown> | null;
      const fullText = typeof gs?.text === "string" ? gs.text : "";
      const paras = fullText
        .split(/\n{2,}|(?<=[\.!\?])\s+(?=[A-Z\u0600-\u06FF])/)
        .map((s) => s.trim())
        .filter((s) => s.length > 10)
        .slice(0, 12);
      pages = paras.map((text) => ({ text, image_url: null }));
    }

    const { data: ills } = await admin
      .from("generated_illustrations")
      .select("page_index,image_url,status")
      .eq("story_id", storyId)
      .eq("status", "completed");
    if (ills && ills.length > 0) {
      for (const ill of ills) {
        if (ill.page_index >= 0 && ill.page_index < pages.length && ill.image_url) {
          pages[ill.page_index].image_url = ill.image_url;
        }
      }
    }

    if (pages.length === 0) {
      return new Response(JSON.stringify({ error: "no_text_to_narrate" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lang = (story.language || "en").toLowerCase();

    const chunks: Uint8Array[] = [];
    const wordCounts: number[] = [];
    let totalBytes = 0;
    for (let i = 0; i < pages.length; i++) {
      const text = pages[i].text.slice(0, 2500);
      console.log(`narrate-story-full: page ${i + 1}/${pages.length} (${text.length} chars)`);
      const buf = await synthesizeSpeech({
        text,
        language: lang,
        character: character || undefined,
      });
      chunks.push(buf);
      totalBytes += buf.length;
      wordCounts.push(text.split(/\s+/).filter(Boolean).length);
    }

    const merged = new Uint8Array(totalBytes);
    let off = 0;
    for (const c of chunks) { merged.set(c, off); off += c.length; }

    const path = `${userId}/${storyId}.mp3`;
    const { error: upErr } = await admin.storage
      .from("story-audio")
      .upload(path, merged, { contentType: "audio/mpeg", upsert: true });
    if (upErr) throw new Error(`upload_failed: ${upErr.message}`);

    const { data: pub } = admin.storage.from("story-audio").getPublicUrl(path);
    const audioUrl = pub.publicUrl;

    const totalWords = wordCounts.reduce((s, n) => s + n, 0) || 1;
    const pageWeights = wordCounts.map((n) => n / totalWords);

    await admin
      .from("ai_story_history")
      .update({ audio_url: audioUrl, updated_at: new Date().toISOString() })
      .eq("id", storyId);

    return new Response(
      JSON.stringify({
        audio_url: audioUrl,
        pages: pages.length,
        page_weights: pageWeights,
        bytes: totalBytes,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("narrate-story-full error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
