// run-user-backups — daily per-user backup of stories (JSON).
// Iterates users with stories, builds a JSON snapshot, uploads to
// user-backups/{user_id}/{YYYY-MM-DD}.json, enforces per-user storage cap,
// and writes a row in user_backups + notification on failure.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
};

const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Optional body: { userId?: string } — restricts run to one user (retry).
  // When called by an authenticated user, only allow them to retry their own.
  let targetUserId: string | null = null;
  try {
    const body = (await req.json().catch(() => ({}))) as { userId?: string };
    if (typeof body.userId === "string" && body.userId.length > 0) {
      const authHeader = req.headers.get("Authorization") ?? "";
      if (authHeader) {
        const userClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
          { global: { headers: { Authorization: authHeader } } },
        );
        const { data: u } = await userClient.auth.getUser();
        const callerId = u?.user?.id;
        // Allow self-retry; admins (no JWT here = service role from cron) bypass.
        if (callerId && callerId !== body.userId) {
          // Check admin role
          const { data: isAdmin } = await admin
            .from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
          if (!isAdmin) return json({ error: "forbidden" }, 403);
        }
      }
      targetUserId = body.userId;
    }
  } catch { /* no body */ }

  const today = new Date().toISOString().slice(0, 10);

  // Load settings
  const { data: settings } = await admin
    .from("user_backup_settings")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (!settings?.enabled) return json({ skipped: "disabled" });

  const retentionDays: number = settings.retention_days ?? 30;
  const maxBytes: number = (settings.max_size_mb_per_user ?? 500) * 1024 * 1024;
  const notifyFailure: boolean = settings.notify_on_failure ?? true;
  const notifySuccess: boolean = settings.notify_on_success ?? false;

  let userIds: string[];
  if (targetUserId) {
    userIds = [targetUserId];
  } else {
    // Find distinct users with stories
    const { data: storyUsers, error: uErr } = await admin
      .from("ai_story_history")
      .select("user_id")
      .not("user_id", "is", null)
      .limit(10000);
    if (uErr) return json({ error: uErr.message }, 500);
    userIds = Array.from(new Set((storyUsers ?? []).map((r: any) => r.user_id)));
  }


  const results = { ok: 0, failed: 0, skipped: 0 };

  for (const userId of userIds) {
    try {
      // Skip if already backed up today
      const { data: existing } = await admin
        .from("user_backups")
        .select("id, status")
        .eq("user_id", userId)
        .eq("backup_date", today)
        .maybeSingle();
      if (existing && existing.status === "completed") {
        results.skipped++;
        continue;
      }

      // Collect stories (JSON-only snapshot)
      const { data: stories, error: sErr } = await admin
        .from("ai_story_history")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (sErr) throw sErr;

      const snapshot = {
        kind: "najmah-user-backup",
        version: 1,
        user_id: userId,
        backup_date: today,
        generated_at: new Date().toISOString(),
        story_count: stories?.length ?? 0,
        stories: stories ?? [],
      };
      const body = new TextEncoder().encode(JSON.stringify(snapshot));
      const sizeBytes = body.byteLength;

      // Enforce per-user storage cap (sum of existing + new)
      const { data: prior } = await admin
        .from("user_backups")
        .select("size_bytes")
        .eq("user_id", userId);
      const used = (prior ?? []).reduce((a: number, r: any) => a + (r.size_bytes ?? 0), 0);
      if (used + sizeBytes > maxBytes) {
        // Try deleting oldest until we fit
        const { data: oldest } = await admin
          .from("user_backups")
          .select("id, storage_path, size_bytes")
          .eq("user_id", userId)
          .order("backup_date", { ascending: true });
        let freed = 0;
        for (const old of oldest ?? []) {
          if (used + sizeBytes - freed <= maxBytes) break;
          await admin.storage.from("user-backups").remove([old.storage_path]).catch(() => {});
          await admin.from("user_backups").delete().eq("id", old.id);
          freed += old.size_bytes ?? 0;
        }
        if (used + sizeBytes - freed > maxBytes) {
          throw new Error(`storage_cap_exceeded (${Math.round((used + sizeBytes) / 1024)}KB > ${Math.round(maxBytes / 1024)}KB)`);
        }
      }

      // Upload
      const path = `${userId}/${today}.json`;
      const { error: upErr } = await admin.storage
        .from("user-backups")
        .upload(path, body, { contentType: "application/json", upsert: true });
      if (upErr) throw upErr;

      const expiresAt = new Date(Date.now() + retentionDays * 86400_000).toISOString();
      await admin
        .from("user_backups")
        .upsert({
          user_id: userId,
          backup_date: today,
          storage_path: path,
          size_bytes: sizeBytes,
          story_count: stories?.length ?? 0,
          status: "completed",
          error_message: null,
          expires_at: expiresAt,
        }, { onConflict: "user_id,backup_date" });

      if (notifySuccess) {
        await admin.from("user_notifications").insert({
          user_id: userId,
          kind: "backup_success",
          title: "Backup completed",
          message: `Daily backup saved (${stories?.length ?? 0} stories).`,
          severity: "success",
        });
      }
      results.ok++;
    } catch (e) {
      const msg = String((e as Error)?.message ?? e).slice(0, 500);
      await admin.from("user_backups").upsert({
        user_id: userId,
        backup_date: today,
        storage_path: `${userId}/${today}.json`,
        size_bytes: 0,
        story_count: 0,
        status: "failed",
        error_message: msg,
        expires_at: new Date(Date.now() + retentionDays * 86400_000).toISOString(),
      }, { onConflict: "user_id,backup_date" });
      if (notifyFailure) {
        await admin.from("user_notifications").insert({
          user_id: userId,
          kind: "backup_failed",
          title: "Backup failed",
          message: `We couldn't back up your stories today. Reason: ${msg}`,
          severity: "error",
        });
      }
      results.failed++;
    }
  }

  return json({ date: today, total: userIds.length, ...results });
});
