// narrate-story-edge: generates a downloadable MP3 for a story using
// Microsoft Edge Read Aloud TTS (free, no API key, no billing).
// Always returns HTTP 200 with { success, code?, message?, url? }.
import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { chunkForEdgeTts, synthesizeEdgeTts } from "../_shared/edgeTts.ts";

const AR_VOICES = [
  "ar-EG-SalmaNeural",
  "ar-EG-ShakirNeural",
  "ar-SA-ZariyahNeural",
  "ar-SA-HamedNeural",
];
const EN_VOICES = [
  "en-US-AriaNeural",
  "en-US-GuyNeural",
  "en-US-JennyNeural",
  "en-GB-SoniaNeural",
];

function jsonOk(body: unknown, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  const cors = buildCorsHeaders(req);
  const pre = handlePreflight(req);
  if (pre) return pre;

  try {
    const body = await req.json().catch(() => ({}));
    const { text, language, voice, storyId } = (body ?? {}) as {
      text?: string;
      language?: string;
      voice?: string;
      storyId?: string;
    };

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return jsonOk(
        { success: false, code: "invalid_input", message: "Missing story text." },
        cors,
      );
    }
    if (text.length > 20000) {
      return jsonOk(
        {
          success: false,
          code: "text_too_long",
          message: "Story is too long for MP3 export (limit 20,000 characters).",
        },
        cors,
      );
    }

    // Auth
    const auth = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const { data: u } = await userClient.auth.getUser();
    const userId = u?.user?.id;
    if (!userId) {
      return jsonOk(
        {
          success: false,
          code: "unauthorized",
          message: "Please sign in to download the audio.",
        },
        cors,
      );
    }

    // Voice selection
    const langPrefix = (language || "en").toLowerCase().startsWith("ar")
      ? "ar"
      : "en";
    const pool = langPrefix === "ar" ? AR_VOICES : EN_VOICES;
    const chosenVoice = voice && pool.includes(voice) ? voice : pool[0];

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Cache: same story + voice → serve existing file
    const filename = storyId
      ? `${storyId}-${chosenVoice}.mp3`
      : `oneoff-${crypto.randomUUID()}.mp3`;
    const path = `${userId}/${filename}`;

    if (storyId) {
      const { data: listed } = await admin.storage
        .from("story-audio")
        .list(userId, { search: filename });
      if (listed && listed.some((f) => f.name === filename)) {
        const { data: pub } = admin.storage
          .from("story-audio")
          .getPublicUrl(path);
        return jsonOk(
          {
            success: true,
            url: pub.publicUrl,
            voice: chosenVoice,
            cached: true,
          },
          cors,
        );
      }
    }

    // Synthesize (chunked + retry with exponential backoff)
    const chunks = chunkForEdgeTts(text);
    const audioParts: Uint8Array[] = [];
    for (const chunk of chunks) {
      let succeeded = false;
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const audio = await synthesizeEdgeTts({
            text: chunk,
            voice: chosenVoice,
          });
          audioParts.push(audio);
          succeeded = true;
          break;
        } catch (e) {
          lastErr = e;
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1) ** 2));
        }
      }
      if (!succeeded) {
        console.error("[narrate-story-edge] chunk failed", lastErr);
        return jsonOk(
          {
            success: false,
            code: "tts_upstream_failed",
            message:
              "Voice generation is temporarily unavailable. Please try again in a moment.",
          },
          cors,
        );
      }
    }

    // MP3 supports simple concatenation of frame streams
    let total = 0;
    for (const c of audioParts) total += c.length;
    const merged = new Uint8Array(total);
    let off = 0;
    for (const c of audioParts) {
      merged.set(c, off);
      off += c.length;
    }

    const { error: upErr } = await admin.storage
      .from("story-audio")
      .upload(path, merged, {
        contentType: "audio/mpeg",
        upsert: true,
      });
    if (upErr) {
      console.error("[narrate-story-edge] upload failed", upErr);
      return jsonOk(
        {
          success: false,
          code: "storage_upload_failed",
          message: "Could not save the audio file. Please try again.",
        },
        cors,
      );
    }

    const { data: pub } = admin.storage.from("story-audio").getPublicUrl(path);
    return jsonOk(
      {
        success: true,
        url: pub.publicUrl,
        voice: chosenVoice,
        bytes: merged.length,
        cached: false,
      },
      cors,
    );
  } catch (e) {
    console.error("[narrate-story-edge] fatal", e);
    return jsonOk(
      {
        success: false,
        code: "internal_error",
        message: "Something went wrong. Please try again.",
      },
      cors,
    );
  }
});
