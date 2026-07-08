// Microsoft Edge Read Aloud TTS (free, no API key).
// Speaks to `speech.platform.bing.com` over a WebSocket exactly like the
// Edge browser's built-in Read Aloud feature. Returns MP3 bytes.
//
// Voice list: https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list
// Reference: https://github.com/rany2/edge-tts

const TRUSTED_CLIENT_TOKEN = "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const CHROMIUM_FULL_VERSION = "130.0.2849.68";
const WSS_URL =
  "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1";

async function generateSecMsGec(): Promise<string> {
  // WinFileTime = (unix_time + 11644473600) * 10^7, rounded down to nearest 5 min
  let ticks =
    BigInt(Math.floor(Date.now() / 1000) + 11644473600) * 10000000n;
  ticks -= ticks % 3000000000n;
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

export interface SynthesizeOpts {
  text: string;
  voice: string;
  rate?: string; // e.g. "+0%"
  pitch?: string; // e.g. "+0Hz"
  volume?: string; // e.g. "+0%"
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Synthesize a single text chunk (safe up to ~3000 chars) to MP3 bytes. */
export async function synthesizeEdgeTts(
  opts: SynthesizeOpts,
): Promise<Uint8Array> {
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
    const timeout = setTimeout(() => {
      try {
        ws.close();
      } catch {
        /* noop */
      }
      reject(new Error("edge_tts_timeout"));
    }, 45000);

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
              outputFormat: "audio-24khz-48kbitrate-mono-mp3",
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
        // Text frame — headers only. `Path:turn.end` marks completion.
        if (ev.data.includes("Path:turn.end")) {
          clearTimeout(timeout);
          try {
            ws.close();
          } catch {
            /* noop */
          }
          let total = 0;
          for (const c of chunks) total += c.length;
          const out = new Uint8Array(total);
          let off = 0;
          for (const c of chunks) {
            out.set(c, off);
            off += c.length;
          }
          if (out.length === 0) {
            reject(new Error("edge_tts_empty_audio"));
          } else {
            resolve(out);
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

    ws.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("edge_tts_ws_error"));
    };

    ws.onclose = (e) => {
      if (chunks.length === 0) {
        clearTimeout(timeout);
        reject(new Error(`edge_tts_closed:${e.code}`));
      }
    };
  });
}

/** Split text on sentence boundaries into chunks safe for Edge TTS. */
export function chunkForEdgeTts(text: string, maxLen = 2800): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= maxLen) return [clean];
  const parts: string[] = [];
  const sentences = clean.split(/(?<=[.!?؟\n])\s+/);
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
    if (p.length <= maxLen) {
      final.push(p);
      continue;
    }
    for (let i = 0; i < p.length; i += maxLen) {
      final.push(p.slice(i, i + maxLen));
    }
  }
  return final;
}
