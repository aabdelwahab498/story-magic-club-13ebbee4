// Sliding-window rate limiter backed by Postgres.
// Uses the SERVICE ROLE key so it works regardless of caller's auth state.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

let _admin: SupabaseClient | null = null;
function admin(): SupabaseClient {
  if (_admin) return _admin;
  _admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  return _admin;
}

export interface RateLimitRule {
  windowSec: number;
  max: number;
  /** Optional: block the identifier on this endpoint for N seconds after the window is exceeded. */
  blockSec?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number; // seconds
  remaining: number;
  reason?: "blocked" | "rate_limited";
}

/** Build a stable identifier from the incoming request. Prefers user id, falls back to IP. */
export async function identifierFromRequest(req: Request): Promise<string> {
  const auth = req.headers.get("Authorization") ?? "";
  if (auth.startsWith("Bearer ")) {
    try {
      const { data } = await admin().auth.getUser(auth.slice(7));
      if (data?.user?.id) return `u:${data.user.id}`;
    } catch { /* ignore */ }
  }
  const xf = req.headers.get("x-forwarded-for") ?? req.headers.get("cf-connecting-ip") ?? "";
  const ip = xf.split(",")[0]?.trim() || "unknown";
  return `ip:${ip}`;
}

/**
 * Check + record a request against the rate-limit window.
 * Returns { allowed: false, retryAfter } if the limit is exceeded or the identifier is blocked.
 * On allowed=true the call has already been recorded.
 */
export async function checkRateLimit(
  identifier: string,
  endpoint: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  const sb = admin();
  const now = Date.now();

  // 1. Active block?
  const { data: blocks } = await sb
    .from("rate_limit_blocks")
    .select("blocked_until")
    .eq("identifier", identifier)
    .eq("endpoint", endpoint)
    .gt("blocked_until", new Date(now).toISOString())
    .order("blocked_until", { ascending: false })
    .limit(1);
  if (blocks && blocks.length > 0) {
    const until = new Date(blocks[0].blocked_until).getTime();
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((until - now) / 1000)), remaining: 0, reason: "blocked" };
  }

  // 2. Count events in window
  const windowStart = new Date(now - rule.windowSec * 1000).toISOString();
  const { count } = await sb
    .from("rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("identifier", identifier)
    .eq("endpoint", endpoint)
    .gte("created_at", windowStart);

  const used = count ?? 0;
  if (used >= rule.max) {
    if (rule.blockSec && rule.blockSec > 0) {
      await sb.from("rate_limit_blocks").insert({
        identifier,
        endpoint,
        reason: `exceeded ${rule.max}/${rule.windowSec}s`,
        blocked_until: new Date(now + rule.blockSec * 1000).toISOString(),
      });
      return { allowed: false, retryAfter: rule.blockSec, remaining: 0, reason: "blocked" };
    }
    return { allowed: false, retryAfter: rule.windowSec, remaining: 0, reason: "rate_limited" };
  }

  // 3. Record this hit (best-effort)
  await sb.from("rate_limit_events").insert({ identifier, endpoint });

  return { allowed: true, retryAfter: 0, remaining: rule.max - used - 1 };
}

/**
 * Check multiple windows (e.g. per-hour AND per-day). Returns the first failing one.
 */
export async function checkRateLimits(
  identifier: string,
  endpoint: string,
  rules: RateLimitRule[],
): Promise<RateLimitResult> {
  for (const rule of rules) {
    const r = await checkRateLimit(identifier, endpoint, rule);
    if (!r.allowed) return r;
  }
  return { allowed: true, retryAfter: 0, remaining: 0 };
}

/** Helper: build a 429 Response with Retry-After header and CORS. */
export function rateLimitResponse(
  result: RateLimitResult,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({
      error: "rate_limited",
      reason: result.reason ?? "rate_limited",
      retry_after: result.retryAfter,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(result.retryAfter),
      },
    },
  );
}
