// Browser TTS fallback using the Web Speech API.
// Used when the primary TTS service (ElevenLabs) is unavailable so the user
// always gets narration, even if the voice quality is more basic.

// Pitch / rate tuning to match each storyteller persona
const CHARACTER_PROFILE: Record<
  string,
  { pitch: number; rate: number; preferGender?: "male" | "female" }
> = {
  wizard: { pitch: 0.85, rate: 0.9, preferGender: "male" },      // wise old man — natural deep male
  fairy: { pitch: 1.6, rate: 1.05, preferGender: "female" },    // friendly woman
  robot: { pitch: 0.45, rate: 0.9 },                             // flat, mechanical
  dragon: { pitch: 1.5, rate: 1.2, preferGender: "female" },    // energetic child
  alien: { pitch: 1.8, rate: 1.25 },                             // alien-like, high & quick
};

// Age modifier — younger listeners get slightly slower, slightly higher
// (warmer, more sing-song) delivery; older listeners get a flatter, more
// natural pace. Values are multiplied/added on top of the character profile.
const AGE_MODIFIER: Record<string, { pitchAdd: number; rateMul: number }> = {
  "3-5": { pitchAdd: 0.15, rateMul: 0.85 }, // softer, slower, more playful
  "6-8": { pitchAdd: 0.05, rateMul: 0.95 }, // slightly slower, friendly
  "9-12": { pitchAdd: -0.05, rateMul: 1.05 }, // closer to natural, a bit faster
};

// Map app language codes → BCP-47 prefixes accepted by SpeechSynthesis
const LANG_MAP: Record<string, string> = {
  en: "en",
  ar: "ar",
  fr: "fr",
  de: "de",
  it: "it",
  es: "es",
};

export function isBrowserTtsSupported(): boolean {
  return typeof window !== "undefined"
    && "speechSynthesis" in window
    && typeof window.SpeechSynthesisUtterance !== "undefined";
}

// -----------------------------------------------------------------------------
// User preferences (persisted in localStorage)
// -----------------------------------------------------------------------------
const RATE_KEY = "starry-tales-narrator-rate";
const VOICE_KEY = "starry-tales-narrator-voice";

export function getNarratorRate(): number {
  if (typeof window === "undefined") return 1;
  const raw = Number(window.localStorage.getItem(RATE_KEY));
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  return Math.max(0.5, Math.min(2, raw));
}
export function setNarratorRate(rate: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RATE_KEY, String(Math.max(0.5, Math.min(2, rate))));
}
export function getNarratorVoiceURI(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(VOICE_KEY) || "";
}
export function setNarratorVoiceURI(uri: string) {
  if (typeof window === "undefined") return;
  if (uri) window.localStorage.setItem(VOICE_KEY, uri);
  else window.localStorage.removeItem(VOICE_KEY);
}

/** List installed voices, optionally filtered by BCP-47 prefix (e.g. "ar", "en"). */
export async function listBrowserVoices(langPrefix?: string): Promise<SpeechSynthesisVoice[]> {
  if (!isBrowserTtsSupported()) return [];
  const voices = await loadVoices();
  if (!langPrefix) return voices;
  const p = langPrefix.toLowerCase();
  return voices.filter((v) => v.lang.toLowerCase().startsWith(p));
}

// Voices load asynchronously in some browsers. We cache them after the first
// successful load so subsequent narrations start instantly (no 1.5s wait).
let cachedVoices: SpeechSynthesisVoice[] | null = null;

function primeVoices() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  const v = synth.getVoices();
  if (v.length) cachedVoices = v;
  // Listen once — Chrome fires this when voices become available.
  synth.addEventListener(
    "voiceschanged",
    () => {
      const list = synth.getVoices();
      if (list.length) cachedVoices = list;
    },
    { once: false },
  );
}
// Prime as soon as this module is imported so the list is ready by the time
// the user clicks Play.
primeVoices();

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (cachedVoices && cachedVoices.length) return resolve(cachedVoices);
    const synth = window.speechSynthesis;
    const existing = synth.getVoices();
    if (existing.length) {
      cachedVoices = existing;
      return resolve(existing);
    }
    const handler = () => {
      synth.removeEventListener("voiceschanged", handler);
      const list = synth.getVoices();
      cachedVoices = list;
      resolve(list);
    };
    synth.addEventListener("voiceschanged", handler);
    // Shorter safety timeout — most browsers populate within ~200ms.
    // If still empty we just fall through with no voice (default is used).
    setTimeout(() => resolve(cachedVoices ?? synth.getVoices()), 400);
  });
}

function pickVoice(
  voices: SpeechSynthesisVoice[],
  langPrefix: string,
  preferGender?: "male" | "female",
): { voice?: SpeechSynthesisVoice; genderMatched: boolean } {
  const matchLang = voices.filter((v) =>
    v.lang.toLowerCase().startsWith(langPrefix.toLowerCase()),
  );
  const pool = matchLang.length ? matchLang : voices;
  if (preferGender) {
    const wanted = preferGender === "female"
      ? /(female|woman|samantha|victoria|karen|tessa|moira|fiona|amira|laila|salma|hoda|amina|zeina|wavenet-a|wavenet-d|-female|standard-a|standard-d)/i
      : /(male|man|daniel|alex|fred|aaron|tom|george|brian|amir|hamed|majed|naji|tarik|naayf|nizar|wavenet-b|wavenet-c|-male|standard-b|standard-c)/i;
    const opposite = preferGender === "female"
      ? /(male|man|daniel|alex|fred|aaron|tom|george|brian|hamed|majed|tarik|naayf)/i
      : /(female|woman|samantha|victoria|karen|tessa|moira|fiona|amira|laila|salma|hoda|amina|zeina)/i;
    const gendered = pool.find((v) => wanted.test(v.name));
    if (gendered) return { voice: gendered, genderMatched: true };
    // Try any voice in the language that's NOT obviously the opposite gender
    const neutral = pool.find((v) => !opposite.test(v.name));
    if (neutral) return { voice: neutral, genderMatched: false };
  }
  return { voice: pool[0], genderMatched: false };
}

export interface BrowserTtsHandle {
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  isSpeaking: () => boolean;
}

// Mobile browsers (especially iOS Safari) require a "warm-up" — the very first
// utterance after a user gesture initialises the audio engine and can take 1–3s.
// We fire a tiny silent utterance immediately so subsequent narrations start fast.
let warmedUp = false;
export function warmUpBrowserTts() {
  if (warmedUp) return;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  warmedUp = true;
  try {
    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0; // silent
    u.rate = 1;
    synth.speak(u);
    setTimeout(() => {
      try { synth.resume(); } catch { /* noop */ }
    }, 50);
  } catch {
    /* noop */
  }
}

export async function speakWithBrowser({
  text,
  language,
  character,
  ageId,
  onEnd,
  onError,
}: {
  text: string;
  language: string;
  character?: string;
  ageId?: string;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
}): Promise<BrowserTtsHandle> {
  if (!isBrowserTtsSupported()) {
    throw new Error("browser_tts_unsupported");
  }
  const synth = window.speechSynthesis;
  // Cancel anything already queued/playing
  synth.cancel();
  // Mobile Safari often pauses the synth queue when idle — explicit resume helps.
  try { synth.resume(); } catch { /* noop */ }

  // Use cached voices instantly if available — DON'T await on mobile, the wait
  // itself is what makes narration feel slow on phones/tablets.
  const immediate = cachedVoices ?? synth.getVoices();
  const voices = immediate.length ? immediate : await loadVoices();
  const profile = (character && CHARACTER_PROFILE[character]) || {
    pitch: 1,
    rate: 1,
  };
  const ageMod = (ageId && AGE_MODIFIER[ageId]) || { pitchAdd: 0, rateMul: 1 };
  const langPrefix = LANG_MAP[language] || "en";
  const { voice, genderMatched } = pickVoice(voices, langPrefix, profile.preferGender);
  // If we wanted male but couldn't find one in this language, drop pitch hard
  // to simulate a deeper, masculine voice (e.g. Arabic only ships female voices).
  const genderPitchAdj =
    profile.preferGender === "male" && !genderMatched ? -0.35 :
    profile.preferGender === "female" && !genderMatched ? 0.25 : 0;
  // Clamp to valid SpeechSynthesis ranges (pitch 0–2, rate 0.1–10)
  const finalPitch = Math.max(0, Math.min(2, profile.pitch + ageMod.pitchAdd + genderPitchAdj));
  const finalRate = Math.max(0.1, Math.min(10, profile.rate * ageMod.rateMul));

  // Some browsers (Chrome) silently truncate utterances over ~200 chars,
  // so we split on sentence boundaries and queue them sequentially.
  // We also keep the FIRST chunk extra short (~80 chars) so playback starts
  // almost instantly — the rest queues up while the first sentence plays.
  const chunks = splitIntoChunks(text, 180, 80);

  let cancelled = false;

  for (let i = 0; i < chunks.length; i++) {
    const u = new SpeechSynthesisUtterance(chunks[i]);
    if (voice) u.voice = voice;
    u.lang = voice?.lang || langPrefix;
    u.pitch = finalPitch;
    u.rate = finalRate;
    u.volume = 1;
    if (i === chunks.length - 1) {
      u.onend = () => {
        if (!cancelled) onEnd?.();
      };
    }
    u.onerror = (ev) => {
      // "interrupted" / "canceled" fire when we intentionally stop — ignore
      const err = (ev as SpeechSynthesisErrorEvent).error;
      if (err === "canceled" || err === "interrupted") return;
      onError?.(err);
    };
    synth.speak(u);
  }

  return {
    pause: () => synth.pause(),
    resume: () => synth.resume(),
    cancel: () => {
      cancelled = true;
      synth.cancel();
    },
    isSpeaking: () => synth.speaking,
  };
}

function splitIntoChunks(text: string, maxLen: number, firstMaxLen?: number): string[] {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?؟])\s+/)
    .filter(Boolean);
  const out: string[] = [];
  let buf = "";
  const limitFor = (idx: number) =>
    idx === 0 && firstMaxLen ? firstMaxLen : maxLen;
  for (const s of sentences) {
    if ((buf + " " + s).trim().length > limitFor(out.length) && buf) {
      out.push(buf.trim());
      buf = s;
    } else {
      buf = buf ? buf + " " + s : s;
    }
  }
  if (buf) out.push(buf.trim());
  return out;
}
