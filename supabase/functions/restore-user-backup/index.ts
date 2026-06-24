// restore-user-backup — issues a short-lived signed URL (5min) so the
// authenticated owner can download their backup JSON. Verifies ownership.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const SIGNED_TTL = 300; // 5 minutes

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { backupId } = (await req.json().catch(() => ({}))) as { backupId?: string };
    const id = typeof backupId === "string" ? backupId.slice(0, 64) : "";
    if (!id) return json({ error: "missing_backup_id" }, 400);

    // Authenticate caller
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: u } = await userClient.auth.getUser();
    const userId = u?.user?.id;
    if (!userId) return json({ error: "unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: row, error } = await admin
      .from("user_backups")
      .select("user_id, storage_path, status")
      .eq("id", id)
      .maybeSingle();
    if (error || !row) return json({ error: "not_found" }, 404);
    if (row.user_id !== userId) {
      // Allow admins
      const { data: roles } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (!roles) return json({ error: "forbidden" }, 403);
    }
    if (row.status !== "completed") return json({ error: "backup_not_ready" }, 409);

    const { data: signed, error: sErr } = await admin.storage
      .from("user-backups")
      .createSignedUrl(row.storage_path, SIGNED_TTL);
    if (sErr || !signed) return json({ error: "sign_failed" }, 500);

    return json({ url: signed.signedUrl, expiresIn: SIGNED_TTL });
  } catch (e) {
    return json({ error: "internal_error", message: String((e as Error)?.message ?? e) }, 500);
  }
});
