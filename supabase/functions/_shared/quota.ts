// Server-side subscription/quota enforcement.
// Never trust the frontend — every expensive endpoint must call these helpers.
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

export type PaidFeature = "illustrations" | "pdf" | "audio";

export interface QuotaResult {
  allowed: boolean;
  reason?: "no_user" | "no_plan" | "limit_reached" | "feature_not_in_plan";
  used?: number;
  limit?: number;
  tier?: string;
}

/** True if the user has the requested paid feature on an active subscription. */
export async function hasPaidFeature(userId: string, feature: PaidFeature): Promise<boolean> {
  if (!userId) return false;
  const { data, error } = await admin().rpc("has_paid_feature", { _user_id: userId, _feature: feature });
  if (error) {
    console.error("has_paid_feature error", error);
    return false;
  }
  return data === true;
}

/** Admins always pass; otherwise enforce paid feature. */
export async function enforcePaidFeature(userId: string, feature: PaidFeature): Promise<QuotaResult> {
  if (!userId) return { allowed: false, reason: "no_user" };
  // Admins bypass
  const { data: roleRow } = await admin().rpc("has_role", { _user_id: userId, _role: "admin" });
  if (roleRow === true) return { allowed: true };
  const ok = await hasPaidFeature(userId, feature);
  return ok ? { allowed: true } : { allowed: false, reason: "feature_not_in_plan" };
}

/** Enforce monthly story creation cap based on the user's active plan. */
export async function enforceMonthlyStoryQuota(userId: string): Promise<QuotaResult> {
  if (!userId) return { allowed: false, reason: "no_user" };
  const sb = admin();

  // Admins bypass
  const { data: isAdmin } = await sb.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (isAdmin === true) return { allowed: true, tier: "admin" };

  // Resolve active subscription tier (fallback to 'free')
  const { data: sub } = await sb
    .from("user_subscriptions")
    .select("plan_tier, status, expires_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const tier = (sub?.plan_tier as string) ?? "free";

  // Resolve plan limit
  const { data: plan } = await sb
    .from("subscription_plans")
    .select("monthly_story_limit")
    .eq("tier", tier)
    .eq("active", true)
    .maybeSingle();
  if (!plan) return { allowed: false, reason: "no_plan", tier };
  const limit = plan.monthly_story_limit ?? 0;

  // Count stories created this calendar month
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const { count } = await sb
    .from("ai_story_history")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", start.toISOString());

  const used = count ?? 0;
  if (used >= limit) {
    return { allowed: false, reason: "limit_reached", used, limit, tier };
  }
  return { allowed: true, used, limit, tier };
}

/** Build a 402/403 Response when a quota check fails. */
export function quotaResponse(result: QuotaResult, corsHeaders: Record<string, string>): Response {
  const status = result.reason === "limit_reached" ? 402
    : result.reason === "feature_not_in_plan" ? 402
    : 403;
  return new Response(
    JSON.stringify({
      error: "quota_exceeded",
      reason: result.reason,
      used: result.used,
      limit: result.limit,
      tier: result.tier,
    }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

/** Resolve the calling user id from the JWT, or null if anonymous. */
export async function userIdFromRequest(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  try {
    const { data } = await admin().auth.getUser(auth.slice(7));
    return data?.user?.id ?? null;
  } catch {
    return null;
  }
}
