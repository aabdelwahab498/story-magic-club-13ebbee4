// narrate-story-edge
// Thin HTTP wrapper around the TTS service layer. All provider details,
// chunking, retries, storage, and logging live in `_shared/tts/service.ts`.
// Always returns HTTP 200 with a structured JSON body so the client never
// sees a raw non-2xx / server-side error.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";
import { generateSpeech, TtsError } from "../_shared/tts/service.ts";

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

    // Authenticate the caller.
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

    const result = await generateSpeech({
      text: text ?? "",
      language,
      voice,
      storyId,
      userId,
    });

    return jsonOk(
      {
        success: true,
        status: result.status, // "success" | "cached"
        audioUrl: result.audioUrl,
        duration: result.duration,
        fileSize: result.fileSize,
        voice: result.voice,
        provider: result.provider,
        language: result.language,
        chunkCount: result.chunkCount,
      },
      cors,
    );
  } catch (e) {
    if (e instanceof TtsError) {
      console.log(JSON.stringify({ scope: "narrate-story-edge", code: e.code, message: e.userMessage }));
      return jsonOk(
        { success: false, code: e.code, message: e.userMessage },
        cors,
      );
    }
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
