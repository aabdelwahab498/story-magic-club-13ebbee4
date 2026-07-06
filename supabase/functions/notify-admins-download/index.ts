import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Payload {
  story_id?: string | null;
  story_title?: string | null;
  format: string;
  file_size_bytes?: number | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return json({ error: "unauthorized" }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify the caller
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: uData, error: uErr } = await userClient.auth.getUser();
    if (uErr || !uData?.user) return json({ error: "unauthorized" }, 401);
    const actor = uData.user;

    const body = (await req.json().catch(() => ({}))) as Payload;
    if (!body?.format) return json({ error: "format required" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Look up display name
    const { data: prof } = await admin
      .from("profiles")
      .select("display_name")
      .eq("user_id", actor.id)
      .maybeSingle();
    const who =
      prof?.display_name ?? actor.email ?? actor.id.slice(0, 8);

    // Get admin user_ids
    const { data: admins, error: aErr } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    if (aErr) return json({ error: aErr.message }, 500);
    if (!admins?.length) return json({ ok: true, notified: 0 });

    const title = `📥 ${who} حمّل قصة`;
    const message = `${body.story_title ?? "Untitled"} — ${body.format.toUpperCase()}${
      body.file_size_bytes ? ` (${Math.round(body.file_size_bytes / 1024)} KB)` : ""
    }`;

    const rows = admins.map((a) => ({
      user_id: a.user_id,
      kind: "story_download",
      title,
      message,
      severity: "info",
      metadata: {
        actor_id: actor.id,
        actor_name: who,
        story_id: body.story_id ?? null,
        story_title: body.story_title ?? null,
        format: body.format,
        file_size_bytes: body.file_size_bytes ?? null,
      },
    }));

    const { error: insErr } = await admin.from("user_notifications").insert(rows);
    if (insErr) return json({ error: insErr.message }, 500);

    return json({ ok: true, notified: rows.length });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
