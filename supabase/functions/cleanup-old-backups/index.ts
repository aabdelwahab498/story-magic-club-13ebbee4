// cleanup-old-backups — deletes backups past their expires_at (storage + row).
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

  const { data: expired, error } = await admin
    .from("user_backups")
    .select("id, storage_path")
    .lt("expires_at", new Date().toISOString())
    .limit(1000);
  if (error) return json({ error: error.message }, 500);

  const paths = (expired ?? []).map((r: any) => r.storage_path).filter(Boolean);
  if (paths.length) {
    await admin.storage.from("user-backups").remove(paths).catch(() => {});
    await admin.from("user_backups").delete().in("id", (expired ?? []).map((r: any) => r.id));
  }

  return json({ deleted: paths.length });
});
