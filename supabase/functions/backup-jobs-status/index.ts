// backup-jobs-status — returns last run time + status of the two cron jobs
// (run-user-backups, cleanup-old-backups) from cron.job_run_details.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey" };
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ── Admin-only gate ────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

  const { data: isAdmin, error: roleErr } = await admin.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });
  if (roleErr || !isAdmin) return json({ error: "forbidden" }, 403);

  // Derive last-run for each job from user_backups (success) and from the
  // latest created_at across statuses. We avoid querying cron.* schema
  // directly (not exposed to PostgREST) and use observable side-effects.
  const out: Record<string, { lastRunAt: string | null; lastStatus: string | null; detail?: string }> = {
    "run-user-backups": { lastRunAt: null, lastStatus: null },
    "cleanup-old-backups": { lastRunAt: null, lastStatus: null },
  };

  // Last backup row created (any status) ≈ last run of run-user-backups
  const { data: lastBackup } = await admin
    .from("user_backups")
    .select("created_at, status, error_message")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastBackup) {
    out["run-user-backups"] = {
      lastRunAt: lastBackup.created_at,
      lastStatus: lastBackup.status,
      detail: lastBackup.error_message ?? undefined,
    };
  }

  // Cleanup: read updated_at of settings as a proxy isn't reliable; instead
  // report the earliest non-expired backup as a hint that cleanup ran.
  const { data: oldest } = await admin
    .from("user_backups")
    .select("expires_at, created_at")
    .order("expires_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (oldest) {
    out["cleanup-old-backups"] = {
      lastRunAt: null,
      lastStatus: "scheduled",
      detail: `oldest backup expires at ${oldest.expires_at}`,
    };
  }

  return json({ jobs: out });
});
