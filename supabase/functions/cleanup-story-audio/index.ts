// cleanup-story-audio
// Scheduled maintenance endpoint. Deletes generated MP3s older than the
// TTL defined in the TTS service layer. Safe to call ad-hoc or via cron.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";
import { AUDIO_TTL_DAYS, cleanupExpiredAudio } from "../_shared/tts/service.ts";

serve(async (req) => {
  const cors = buildCorsHeaders(req);
  const pre = handlePreflight(req);
  if (pre) return pre;
  try {
    const stats = await cleanupExpiredAudio();
    return new Response(
      JSON.stringify({ success: true, ttlDays: AUDIO_TTL_DAYS, ...stats }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[cleanup-story-audio] fatal", e);
    return new Response(
      JSON.stringify({ success: false, code: "internal_error" }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});
