/**
 * Centralized CORS handling.
 *
 * Strict allowlist of origins (Lovable preview, published URL, custom domains,
 * and localhost for dev). For unknown origins we DO NOT echo the Origin header
 * back — instead we fall back to a safe placeholder so the browser blocks the
 * response. We always vary on Origin so caches don't poison the response.
 *
 * To extend, set the `ALLOWED_ORIGINS` Supabase secret to a comma-separated list
 * (e.g. "https://najmah.com,https://www.najmah.com"). These are merged with the
 * built-in allow patterns below.
 */

const STATIC_ALLOWED = new Set<string>([
  "http://localhost:8080",
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:8080",
]);

// Lovable preview/published URL patterns
const ALLOWED_PATTERNS: RegExp[] = [
  /^https:\/\/[a-z0-9-]+\.lovable\.app$/i,
  /^https:\/\/[a-z0-9-]+\.lovableproject\.com$/i,
  /^https:\/\/[a-z0-9.-]+\.sandbox\.lovable\.dev$/i,
];

function envAllowed(): string[] {
  const raw = Deno.env.get("ALLOWED_ORIGINS") ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  if (STATIC_ALLOWED.has(origin)) return true;
  if (envAllowed().includes(origin)) return true;
  return ALLOWED_PATTERNS.some((re) => re.test(origin));
}

/**
 * Build CORS headers for a given request. The Allow-Origin is set ONLY for
 * trusted origins; otherwise we return a placeholder ("null") that browsers
 * will reject — preventing untrusted sites from reading responses.
 */
export function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin");
  const allowed = isOriginAllowed(origin);
  return {
    "Access-Control-Allow-Origin": allowed ? origin! : "null",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/**
 * Convenience for the OPTIONS preflight. Returns a 204 with proper headers
 * (or 403 if origin is not allowed — surfaces config errors faster).
 */
export function handlePreflight(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null;
  const headers = buildCorsHeaders(req);
  const allowed = headers["Access-Control-Allow-Origin"] !== "null";
  return new Response(null, { status: allowed ? 204 : 403, headers });
}
