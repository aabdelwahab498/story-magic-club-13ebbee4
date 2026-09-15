// Production alerting for legacy (deprecated) story-generation invocations.
//
// The canonical authenticated story-create path is Backend Core
// (POST /api/v2/stories). Any authenticated call reaching the legacy
// `generate-story` edge function is a regression and must be reported
// immediately: structured console error (picked up by log aggregation),
// an audit row in `ai_audit_logs`, and an in-app notification for every
// admin so it surfaces without waiting for a log review.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export interface LegacyAlertContext {
  userId: string;
  fn: string;
  req: Request;
  details?: Record<string, unknown>;
}

/** Best-effort: never throws, never blocks the caller's response. */
export async function alertLegacyStoryPath(ctx: LegacyAlertContext): Promise<void> {
  const ip = (ctx.req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  const userAgent = (ctx.req.headers.get("user-agent") ?? "").slice(0, 300) || null;
  const origin = ctx.req.headers.get("origin") ?? ctx.req.headers.get("referer") ?? null;

  // 1) Structured log line — always emitted, even if the DB writes fail.
  console.error("[LEGACY_STORY_PATH_ALERT]", JSON.stringify({
    alert: "legacy_generate_story_invoked",
    severity: "critical",
    fn: ctx.fn,
    userId: ctx.userId,
    origin,
    userAgent,
    at: new Date().toISOString(),
    ...ctx.details,
  }));

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return;

  try {
    const admin = createClient(url, key);
    const payload = {
      fn: ctx.fn,
      origin,
      at: new Date().toISOString(),
      ...ctx.details,
    };

    // 2) Audit trail
    await admin.from("ai_audit_logs").insert([{
      actor_id: ctx.userId,
      action: "legacy_generate_story_invoked",
      entity_type: "story_generation",
      after: payload as never,
      ip,
      user_agent: userAgent,
    }]);

    // 3) Immediate admin notification (deduped to one per admin per hour)
    const { data: admins } = await admin
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "super_admin"]);

    const adminIds = [...new Set((admins ?? []).map((r) => r.user_id as string))];
    if (adminIds.length === 0) return;

    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recent } = await admin
      .from("user_notifications")
      .select("user_id")
      .eq("kind", "legacy_story_path")
      .gte("created_at", since)
      .in("user_id", adminIds);

    const alreadyNotified = new Set((recent ?? []).map((r) => r.user_id as string));
    const rows = adminIds
      .filter((id) => !alreadyNotified.has(id))
      .map((id) => ({
        user_id: id,
        kind: "legacy_story_path",
        severity: "error",
        title: "Legacy story generation detected",
        message: `An authenticated story request reached the deprecated ${ctx.fn} service instead of the canonical backend.`,
        metadata: { ...payload, affected_user_id: ctx.userId } as never,
      }));

    if (rows.length > 0) {
      await admin.from("user_notifications").insert(rows);
    }
  } catch (e) {
    console.error("[LEGACY_STORY_PATH_ALERT] reporting failed", e instanceof Error ? e.message : String(e));
  }
}
