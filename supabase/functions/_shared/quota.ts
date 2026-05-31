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
  reason?:
    | "no_user"
    | "no_plan"
    | "limit_reached"
    | "feature_not_in_plan"
    | "daily_limit_reached"
    | "monthly_limit_reached";
  used?: number;
  limit?: number;
  daily_used?: number;
  daily_limit?: number;
  monthly_used?: number;
  monthly_limit?: number;
  tier?: string;
}

/**
 * Fair-use story quota (text + audio). Uses public.check_story_quota RPC.
 * Replaces the legacy credit-based check. Never consumes credits.
 */
export async function enforceStoryFairUse(userId: string): Promise<QuotaResult> {
  if (!userId) return { allowed: false, reason: "no_user" };
  const { data, error } = await admin().rpc("check_story_quota", { _user_id: userId });
  if (error || !data) {
    console.error("check_story_quota error", error);
    return { allowed: true }; // fail-open: never block legitimate users on infra error
  }
  const r = data as Record<string, unknown>;
  return {
    allowed: r.allowed === true,
    reason: (r.reason as QuotaResult["reason"]) ?? undefined,
    tier: r.tier as string | undefined,
    daily_used: r.daily_used as number | undefined,
    daily_limit: r.daily_limit as number | undefined,
    monthly_used: r.monthly_used as number | undefined,
    monthly_limit: r.monthly_limit as number | undefined,
  };
}

/** Consume illustration credits atomically. Returns success + remaining balance. */
export async function consumeIllustrationCredits(
  userId: string,
  amount: number,
): Promise<{ success: boolean; balance: number; reason?: string }> {
  const { data, error } = await admin().rpc("consume_illustration_credits", {
    _user_id: userId,
    _amount: amount,
  });
  if (error) {
    console.error("consume_illustration_credits error", error);
    return { success: false, balance: 0, reason: "rpc_error" };
  }
  const r = (data ?? {}) as Record<string, unknown>;
  return {
    success: r.success === true,
    balance: (r.balance as number) ?? 0,
    reason: r.reason as string | undefined,
  };
}

/** Refund credits (call when generation fails after debit). */
export async function refundIllustrationCredits(userId: string, amount: number): Promise<void> {
  await admin().rpc("refund_illustration_credits", { _user_id: userId, _amount: amount });
}

/** True if the user is on a tier that allows BYOK + has a valid image key. */
export async function hasValidImageByok(userId: string): Promise<boolean> {
  const sb = admin();
  const { data: sub } = await sb
    .from("user_subscriptions")
    .select("plan_tier")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const tier = sub?.plan_tier as string | undefined;
  if (tier !== "pro_creator" && tier !== "elite_publisher") return false;
  const { data: keys } = await sb
    .from("user_api_keys")
    .select("provider, enabled, validation_status, capabilities")
    .eq("user_id", userId)
    .eq("enabled", true);
  return (keys ?? []).some((k: { validation_status: string | null; capabilities: string[] | null }) =>
    k.validation_status === "valid" && (k.capabilities ?? []).includes("image"),
  );
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

  // BYOK bypass: Pro Creator / Elite Publisher with an enabled, validated
  // personal API key may generate unlimited stories using their own key.
  if (tier === "pro_creator" || tier === "elite_publisher") {
    const { data: keys } = await sb
      .from("user_api_keys")
      .select("provider, enabled, validation_status")
      .eq("user_id", userId)
      .eq("enabled", true)
      .in("provider", ["openai", "openrouter"]);
    const hasValid = (keys ?? []).some(
      (k: { validation_status: string | null }) => k.validation_status === "valid",
    );
    if (hasValid) return { allowed: true, tier };
  }

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
  const isLimit =
    result.reason === "limit_reached" ||
    result.reason === "daily_limit_reached" ||
    result.reason === "monthly_limit_reached" ||
    result.reason === "feature_not_in_plan";
  const status = isLimit ? 402 : 403;
  const errorCode =
    result.reason === "daily_limit_reached" ? "daily_limit_reached"
    : result.reason === "monthly_limit_reached" ? "monthly_limit_reached"
    : "quota_exceeded";
  return new Response(
    JSON.stringify({
      error: errorCode,
      reason: result.reason,
      used: result.used,
      limit: result.limit,
      daily_used: result.daily_used,
      daily_limit: result.daily_limit,
      monthly_used: result.monthly_used,
      monthly_limit: result.monthly_limit,
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
