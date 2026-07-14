// Text-to-Speech provider (modular).
// Prefer Lovable AI Gateway for production MP3 output; fall back to Google
// Cloud TTS only when a valid Google key exists and Lovable AI is unavailable.
//
// To swap providers in the future, implement the same `TtsProvider` interface
// and register it in `getTtsProvider()`.

import { decode as base64Decode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

export interface TtsRequest {
  text: string;
  /** BCP-47 style short code: en, ar, fr, de, it, es */
  language: string;
  /** Optional persona name to bias pitch/rate/voice-gender */
  character?: string;
  /** Optional age band (e.g. "3-5", "6-8", "9-12") to adjust pace */
  ageId?: string;
}

export interface TtsProvider {
  name: string;
  synthesize(req: TtsRequest): Promise<Uint8Array>;
}

// ---------------------------------------------------------------------------
// Google Cloud TTS
// ---------------------------------------------------------------------------

const GOOGLE_TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";

// Neural2 / Wavenet voices per language, with a male & female option.
const GOOGLE_VOICES: Record<string, { languageCode: string; female: string; male: string }> = {
  en: { languageCode: "en-US", female: "en-US-Neural2-F", male: "en-US-Neural2-D" },
  ar: { languageCode: "ar-XA", female: "ar-XA-Wavenet-A", male: "ar-XA-Wavenet-B" },
  fr: { languageCode: "fr-FR", female: "fr-FR-Neural2-C", male: "fr-FR-Neural2-B" },
  de: { languageCode: "de-DE", female: "de-DE-Neural2-C", male: "de-DE-Neural2-B" },
  it: { languageCode: "it-IT", female: "it-IT-Neural2-A", male: "it-IT-Neural2-C" },
  es: { languageCode: "es-ES", female: "es-ES-Neural2-A", male: "es-ES-Neural2-B" },
};

const CHARACTER_PROFILE: Record<
  string,
  { pitch: number; rate: number; preferGender?: "male" | "female" }
> = {
  wizard: { pitch: -4, rate: 0.9, preferGender: "male" },
  fairy: { pitch: 4, rate: 1.05, preferGender: "female" },
  robot: { pitch: -6, rate: 0.95 },
  dragon: { pitch: 3, rate: 1.15, preferGender: "female" },
  alien: { pitch: 6, rate: 1.2 },
};

const AGE_MODIFIER: Record<string, { pitchAdd: number; rateMul: number }> = {
  "3-5": { pitchAdd: 1.5, rateMul: 0.85 },
  "6-8": { pitchAdd: 0.5, rateMul: 0.95 },
  "9-12": { pitchAdd: -0.5, rateMul: 1.05 },
};

class GoogleCloudTtsProvider implements TtsProvider {
  name = "google-cloud-tts";
  constructor(private apiKey: string) {}

  async synthesize(req: TtsRequest): Promise<Uint8Array> {
    const lang = (req.language || "en").toLowerCase().slice(0, 2);
    const voiceCfg = GOOGLE_VOICES[lang] ?? GOOGLE_VOICES.en;
    const profile = (req.character && CHARACTER_PROFILE[req.character.toLowerCase()]) || {
      pitch: 0,
      rate: 1,
    };
    const ageMod = (req.ageId && AGE_MODIFIER[req.ageId]) || { pitchAdd: 0, rateMul: 1 };

    const voiceName = profile.preferGender === "male" ? voiceCfg.male : voiceCfg.female;
    // Google TTS accepts pitch −20..20 semitones, speakingRate 0.25..4.0
    const pitch = Math.max(-20, Math.min(20, profile.pitch + ageMod.pitchAdd));
    const speakingRate = Math.max(0.25, Math.min(4, profile.rate * ageMod.rateMul));

    const url = `${GOOGLE_TTS_URL}?key=${encodeURIComponent(this.apiKey)}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text: req.text },
        voice: { languageCode: voiceCfg.languageCode, name: voiceName },
        audioConfig: {
          audioEncoding: "MP3",
          pitch,
          speakingRate,
          sampleRateHertz: 24000,
        },
      }),
    });

    if (!resp.ok) {
      const errTxt = await resp.text().catch(() => "");
      throw new TtsError(resp.status, `google_tts_failed: ${errTxt.slice(0, 300)}`);
    }
    const data = await resp.json();
    if (!data.audioContent) throw new TtsError(500, "google_tts_empty_audio");
    return base64Decode(data.audioContent);
  }
}

class LovableAiTtsProvider implements TtsProvider {
  name = "lovable-ai-openai-tts";
  constructor(private apiKey: string) {}

  async synthesize(req: TtsRequest): Promise<Uint8Array> {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini-tts",
        input: req.text,
        voice: "alloy",
        response_format: "mp3",
        stream_format: "audio",
        speed: req.ageId === "3-5" ? 0.9 : 1,
        instructions: toneInstructions(req),
      }),
    });

    if (!resp.ok) {
      const errTxt = await resp.text().catch(() => "");
      throw new TtsError(resp.status, `lovable_ai_tts_failed: ${errTxt.slice(0, 300)}`);
    }
    const bytes = new Uint8Array(await resp.arrayBuffer());
    if (bytes.byteLength === 0) throw new TtsError(502, "lovable_ai_tts_empty_audio");
    return bytes;
  }
}

function toneInstructions(req: TtsRequest): string {
  const lang = (req.language || "en").toLowerCase().slice(0, 2);
  const base = lang === "ar"
    ? "اقرأ بصوت دافئ وهادئ مناسب للأطفال، مع إيقاع واضح ومطمئن."
    : "Read warmly and calmly for children, with clear pacing and a reassuring tone.";
  if (req.character) return `${base} Keep the narrator persona gentle and expressive: ${req.character}.`;
  return base;
}

export class TtsError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Provider factory — swap here to introduce alternatives later.
// ---------------------------------------------------------------------------

let cached: TtsProvider | null = null;

export function getTtsProvider(): TtsProvider {
  if (cached) return cached;
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (lovableKey) {
    cached = new LovableAiTtsProvider(lovableKey);
    return cached;
  }
  const key = Deno.env.get("GOOGLE_CLOUD_TTS_API_KEY");
  if (!key) throw new TtsError(500, "tts_not_configured");
  cached = new GoogleCloudTtsProvider(key);
  return cached;
}

/** Convenience helper used across narrate-* edge functions. */
export async function synthesizeSpeech(req: TtsRequest): Promise<Uint8Array> {
  return getTtsProvider().synthesize(req);
}
