// narrate-classic-story: generates stitched MP3 narration for a CLASSIC story
// using Google Cloud TTS via the shared TTS module. Persists stories.audio_url.
// Admin/editor only (audio is shared with all readers).
import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { checkRateLimits, rateLimitResponse } from "../_shared/rateLimit.ts";
import { synthesizeSpeech } from "../_shared/tts.ts";

/** Split into 8–14 narration pages by chapter markers or paragraphs. */
function splitPages(text: string): string[] {
  const t = text.trim();
  if (!t) return [];
  const markerRegex = /(?=^\s*(?:Chapter|الفصل|Kapitel|Chapitre|Capitolo|Capítulo)\s+\d+)/gmi;
  const byMarker = t.split(markerRegex).map((s) => s.trim()).filter(Boolean);
  let chunks = byMarker.length > 1 ? byMarker : t.split(/\n\s*\n+/).map((s) => s.trim()).filter(Boolean);
  if (chunks.length === 0) chunks = [t];
  const MAX = 14;
  if (chunks.length > MAX) {
    const head = chunks.slice(0, MAX - 1);
    const tail = chunks.slice(MAX - 1).join("\n\n");
    chunks = [...head, tail];
  }
  if (chunks.length < 4 && chunks[0].length > 2400) {
    const big = chunks[0];
    const parts: string[] = [];
    const sentences = big.split(/(?<=[\.!\?؟])\s+/);
    let buf = "";
    for (const s of sentences) {
      if ((buf + " " + s).length > 600 && buf) { parts.push(buf.trim()); buf = s; }
      else buf = buf ? buf + " " + s : s;
    }
    if (buf) parts.push(buf.trim());
    chunks = parts.slice(0, MAX);
  }
  return chunks.map((c) => c.slice(0, 2500));
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  const pre = handlePreflight(req);
  if (pre) return pre;

  try {
    const { storyId, language = "en", character = "" } = await req.json();
    if (!storyId || typeof storyId !== "string") {
      return new Response(JSON.stringify({ error: "storyId_required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!Deno.env.get("GOOGLE_CLOUD_TTS_API_KEY")) {
      return new Response(JSON.stringify({ error: "tts_not_configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return new Response(JSON.stringify({ error: "unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [{ data: isAdmin }, { data: isEditor }] = await Promise.all([
      admin.rpc("has_role", { _user_id: userId, _role: "admin" }),
      admin.rpc("has_role", { _user_id: userId, _role: "editor" }),
    ]);
    if (!isAdmin && !isEditor) {
      return new Response(JSON.stringify({ error: "forbidden_admin_or_editor_only" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const rl = await checkRateLimits(`u:${userId}`, "narrate-classic-story", [
      { windowSec: 3600, max: 10 },
      { windowSec: 86400, max: 40 },
    ]);
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

    const { data: story, error: e1 } = await admin
      .from("stories")
      .select("id,title,content,image,gallery,audio_url")
      .eq("id", storyId)
      .maybeSingle();
    if (e1 || !story) return new Response(JSON.stringify({ error: "story_not_found" }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const content = (story.content || {}) as Record<string, string>;
    const lang = (language || "en").toLowerCase();
    const text = (content[lang] || content.en || Object.values(content)[0] || "").trim();
    if (!text) return new Response(JSON.stringify({ error: "no_text_for_language" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const pagesText = splitPages(text);
    if (pagesText.length === 0) return new Response(JSON.stringify({ error: "split_failed" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const gallery = Array.isArray(story.gallery) ? (story.gallery as string[]) : [];
    const cover = story.image as string | null;
    const pages = pagesText.map((t, i) => ({
      text: t,
      image_url: gallery[i] || gallery[i % Math.max(1, gallery.length)] || cover || null,
    }));

    const chunks: Uint8Array[] = [];
    const wordCounts: number[] = [];
    let totalBytes = 0;
    for (let i = 0; i < pages.length; i++) {
      console.log(`narrate-classic-story: page ${i + 1}/${pages.length}`);
      const buf = await synthesizeSpeech({
        text: pages[i].text,
        language: lang,
        character: character || undefined,
      });
      chunks.push(buf);
      totalBytes += buf.length;
      wordCounts.push(pages[i].text.split(/\s+/).filter(Boolean).length);
    }

    const merged = new Uint8Array(totalBytes);
    let off = 0;
    for (const c of chunks) { merged.set(c, off); off += c.length; }

    const path = `classic/${storyId}/${lang}.mp3`;
    const { error: upErr } = await admin.storage
      .from("story-audio")
      .upload(path, merged, { contentType: "audio/mpeg", upsert: true });
    if (upErr) throw new Error(`upload_failed: ${upErr.message}`);

    const { data: pub } = admin.storage.from("story-audio").getPublicUrl(path);
    const audioUrl = pub.publicUrl;

    await admin.from("stories")
      .update({ audio_url: audioUrl, updated_at: new Date().toISOString() })
      .eq("id", storyId);

    const totalWords = wordCounts.reduce((s, n) => s + n, 0) || 1;
    const pageWeights = wordCounts.map((n) => n / totalWords);

    return new Response(JSON.stringify({
      audio_url: audioUrl,
      language: lang,
      pages: pages.map((p) => ({ text: p.text, image_url: p.image_url })),
      page_weights: pageWeights,
      bytes: totalBytes,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("narrate-classic-story error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
