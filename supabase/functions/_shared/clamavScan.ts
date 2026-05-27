// ClamAV REST scanner client.
//
// Expects an external HTTP service (see docs/CLAMAV_SELFHOST.md) that:
//   - Accepts POST multipart/form-data with field "FILES" (single binary)
//   - Authenticates via header "X-Scan-Secret: $CLAMAV_SCAN_SECRET"
//   - Returns JSON: { Status: "OK" | "FOUND", Description: string }
//     or HTTP 200 body containing "Everything ok" / "FOUND".
//
// Compatible with `ajilach/clamav-rest` and `lokesh1729/clamav-rest`.
//
// If CLAMAV_SCAN_URL is not configured, returns engine="none" (fail-open with
// a loud log) so the rest of the pipeline keeps working in development.

export type ScanVerdict = "clean" | "infected" | "error" | "skipped";

export interface ScanResult {
  verdict: ScanVerdict;
  engine: "clamav" | "none" | "failover";
  signature?: string;
  raw?: string;
  durationMs: number;
}

const TIMEOUT_MS = 25_000;
const MAX_RETRIES = 2;

export async function scanFile(bytes: Uint8Array, filename: string): Promise<ScanResult> {
  const url = Deno.env.get("CLAMAV_SCAN_URL");
  const secret = Deno.env.get("CLAMAV_SCAN_SECRET");
  const start = Date.now();

  if (!url) {
    console.warn("[clamav] CLAMAV_SCAN_URL not configured — fail-open");
    return { verdict: "skipped", engine: "none", durationMs: 0 };
  }

  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const form = new FormData();
      form.append("FILES", new Blob([bytes]), filename || "upload.bin");
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
      const res = await fetch(url, {
        method: "POST",
        headers: secret ? { "X-Scan-Secret": secret } : undefined,
        body: form,
        signal: ctl.signal,
      });
      clearTimeout(timer);
      const text = await res.text();
      const dur = Date.now() - start;

      if (!res.ok) {
        lastErr = new Error(`clamav ${res.status}: ${text.slice(0, 200)}`);
        continue;
      }

      // Try JSON first, fall back to plain-text contract.
      let parsed: { Status?: string; Description?: string } | null = null;
      try { parsed = JSON.parse(text); } catch { /* not json */ }

      if (parsed?.Status === "FOUND" || /\bFOUND\b/i.test(text)) {
        const sig = parsed?.Description ?? text.match(/:\s*(.+?)\s+FOUND/i)?.[1] ?? "unknown";
        return { verdict: "infected", engine: "clamav", signature: sig.trim(), raw: text.slice(0, 500), durationMs: dur };
      }
      if (parsed?.Status === "OK" || /Everything ok|stream:\s*OK/i.test(text)) {
        return { verdict: "clean", engine: "clamav", raw: text.slice(0, 200), durationMs: dur };
      }
      // Unknown response — treat as error, retry.
      lastErr = new Error(`clamav unrecognised response: ${text.slice(0, 200)}`);
    } catch (e) {
      lastErr = e;
    }
    // exponential backoff
    await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
  }

  console.error("[clamav] scan failed after retries:", lastErr);
  return {
    verdict: "error",
    engine: "failover",
    raw: String(lastErr).slice(0, 300),
    durationMs: Date.now() - start,
  };
}
