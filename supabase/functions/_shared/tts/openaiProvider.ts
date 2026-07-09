// OpenAI TTS fallback provider — routed via the Lovable AI Gateway so no
// direct OpenAI account or key is required. Used only when the primary
// (Edge TTS) provider fails; see `service.ts` `providerChain`.
//
// Docs: https://docs.lovable.dev — /v1/audio/speech, model `openai/gpt-4o-mini-tts`.

import type { TtsProvider, TtsSynthesizeOpts } from "./types.ts";
import { TtsError } from "./types.ts";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/audio/speech";
const MODEL = "openai/gpt-4o-mini-tts";

async function synthesize(opts: TtsSynthesizeOpts): Promise<Uint8Array> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) {
    throw new TtsError(
      "tts_upstream_failed",
      "Fallback voice provider is not configured.",
      undefined,
      { provider: "openai-tts", retryable: false },
    );
  }
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      input: opts.text,
      voice: opts.voice,
      response_format: "mp3",
      stream_format: "audio",
    }),
    signal: opts.signal,
  });
  if (res.status === 429 || res.status === 402) {
    throw new TtsError(
      "tts_upstream_failed",
      "Voice generation is temporarily unavailable.",
      new Error(`gateway ${res.status}`),
      { provider: "openai-tts", retryable: true },
    );
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new TtsError(
      "tts_upstream_failed",
      "Voice generation failed. Please try again.",
      new Error(`gateway ${res.status}: ${txt.slice(0, 200)}`),
      { provider: "openai-tts" },
    );
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.length === 0) {
    throw new TtsError("tts_upstream_failed", "Empty audio from fallback provider.", undefined, {
      provider: "openai-tts",
    });
  }
  return buf;
}

export const openaiTtsProvider: TtsProvider = {
  id: "openai-tts",
  displayName: "OpenAI TTS (fallback)",
  maxChunkChars: 4000,
  voicesByLang: {
    // OpenAI voices are multilingual — the same pool works for ar & en.
    ar: ["alloy", "shimmer", "nova"],
    en: ["alloy", "nova", "shimmer", "echo", "fable", "onyx"],
  },
  synthesize,
};
