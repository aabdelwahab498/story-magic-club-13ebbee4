// Microsoft Edge Read Aloud provider — Deno-native reimplementation of
// the `rany2/edge-tts` Python library.
//
// Talks to `speech.platform.bing.com` over WebSocket exactly like the
// Edge browser's built-in Read Aloud feature. Free, no API key, no
// billing, no credit card. Returns MP3 bytes in the
// `audio-24khz-48kbitrate-mono-mp3` format.
//
// Voice list reference:
//   https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list
// Behaviour reference:
//   https://github.com/rany2/edge-tts

import type { TtsProvider, TtsSynthesizeOpts } from "./types.ts";
import { TtsError } from "./types.ts";

const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const CHROMIUM_FULL_VERSION = "130.0.2849.68";
const WSS_URL =
  "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";
const OUTPUT_FORMAT = "audio-24khz-48kbitrate-mono-mp3";
const SYNTH_TIMEOUT_MS = 45_000;

/** Rounded, per-request security token — replicates edge-tts DRM.py. */
async function generateSecMsGec(): Promise<string> {
  let ticks = BigInt(Math.floor(Date.now() / 1000) + 11644473600) * 10000000n;
  ticks -= ticks % 3000000000n; // round down to nearest 5 min
  const input = `${ticks}${TRUSTED_CLIENT_TOKEN}`;
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function synthesizeOnce(opts: TtsSynthesizeOpts): Promise<Uint8Array> {
  const gec = await generateSecMsGec();
  const url =
    `${WSS_URL}?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}` +
    `&Sec-MS-GEC=${gec}&Sec-MS-GEC-Version=1-${CHROMIUM_FULL_VERSION}`;
  const requestId = crypto.randomUUID().replace(/-/g, "");
  const rate = opts.rate ?? "+0%";
  const pitch = opts.pitch ?? "+0Hz";
  const volume = opts.volume ?? "+0%";

  return await new Promise<Uint8Array>((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    const chunks: Uint8Array[] = [];
    let settled = false;

    const finish = (err: Error | null, out?: Uint8Array) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try { ws.close(); } catch { /* noop */ }
      if (opts.signal) opts.signal.removeEventListener("abort", onAbort);
      if (err) reject(err);
      else resolve(out!);
    };

    const timeout = setTimeout(
      () => finish(new TtsError("tts_timeout", "TTS generation timed out.")),
      SYNTH_TIMEOUT_MS,
    );

    const onAbort = () =>
      finish(new TtsError("tts_upstream_failed", "TTS request aborted."));
    if (opts.signal) {
      if (opts.signal.aborted) return onAbort();
      opts.signal.addEventListener("abort", onAbort);
    }

    ws.onopen = () => {
      const timestamp = new Date().toString();
      const config = {
        context: {
          synthesis: {
            audio: {
              metadataoptions: {
                sentenceBoundaryEnabled: "false",
                wordBoundaryEnabled: "false",
              },
              outputFormat: OUTPUT_FORMAT,
            },
          },
        },
      };
      ws.send(
        `X-Timestamp:${timestamp}\r\n` +
          `Content-Type:application/json; charset=utf-8\r\n` +
          `Path:speech.config\r\n\r\n` +
          JSON.stringify(config),
      );
      const ssml =
        `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>` +
        `<voice name='${opts.voice}'>` +
        `<prosody pitch='${pitch}' rate='${rate}' volume='${volume}'>` +
        `${escapeXml(opts.text)}` +
        `</prosody></voice></speak>`;
      ws.send(
        `X-RequestId:${requestId}\r\n` +
          `Content-Type:application/ssml+xml\r\n` +
          `X-Timestamp:${timestamp}\r\n` +
          `Path:ssml\r\n\r\n` +
          ssml,
      );
    };

    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") {
        if (ev.data.includes("Path:turn.end")) {
          let total = 0;
          for (const c of chunks) total += c.length;
          const out = new Uint8Array(total);
          let off = 0;
          for (const c of chunks) { out.set(c, off); off += c.length; }
          if (out.length === 0) {
            finish(new TtsError("tts_upstream_failed", "Empty audio from provider."));
          } else {
            finish(null, out);
          }
        }
      } else {
        // Binary frame: [2-byte BE header length][header text][audio bytes]
        const buf = new Uint8Array(ev.data as ArrayBuffer);
        if (buf.length < 2) return;
        const headerLen = (buf[0] << 8) | buf[1];
        if (buf.length <= 2 + headerLen) return;
        chunks.push(buf.slice(2 + headerLen));
      }
    };

    ws.onerror = () =>
      finish(new TtsError("tts_upstream_failed", "WebSocket error from TTS."));
    ws.onclose = (e) => {
      if (chunks.length === 0) {
        finish(new TtsError("tts_upstream_failed", `Connection closed (${e.code}).`));
      }
    };
  });
}

/** Split text on sentence boundaries into chunks safe for Edge TTS. */
export function chunkText(text: string, maxLen = 2800): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= maxLen) return [clean];
  const sentences = clean.split(/(?<=[.!?؟\n])\s+/);
  const parts: string[] = [];
  let buf = "";
  for (const s of sentences) {
    if ((buf + " " + s).trim().length > maxLen && buf) {
      parts.push(buf.trim());
      buf = s;
    } else {
      buf = buf ? buf + " " + s : s;
    }
  }
  if (buf) parts.push(buf.trim());
  // Hard-split anything still too long.
  const final: string[] = [];
  for (const p of parts) {
    if (p.length <= maxLen) { final.push(p); continue; }
    for (let i = 0; i < p.length; i += maxLen) {
      final.push(p.slice(i, i + maxLen));
    }
  }
  return final;
}

export const edgeTtsProvider: TtsProvider = {
  id: "edge-tts",
  displayName: "Microsoft Edge Read Aloud",
  maxChunkChars: 2800,
  voicesByLang: {
    ar: [
      "ar-EG-SalmaNeural",
      "ar-EG-ShakirNeural",
      "ar-SA-ZariyahNeural",
      "ar-SA-HamedNeural",
    ],
    en: [
      "en-US-AriaNeural",
      "en-US-GuyNeural",
      "en-US-JennyNeural",
      "en-GB-SoniaNeural",
    ],
  },
  synthesize: synthesizeOnce,
};
