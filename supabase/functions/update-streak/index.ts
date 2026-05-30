// Server-side streak update — prevents client-side tampering.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsErr } = await supabaseAuth.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId: string = claimsData.claims.sub;

    const body = await req.json().catch(() => ({}));
    const minutesRead = Math.max(0, Math.min(120, Number(body?.minutesRead ?? 0))); // cap 2h/event

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: existing } = await admin
      .from("reading_streaks")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    if (!existing) {
      const { error } = await admin.from("reading_streaks").upsert({
        user_id: userId,
        current_streak: 1,
        longest_streak: 1,
        last_active_date: todayStr,
        total_stories_read: 1,
        total_minutes: minutesRead,
      }, { onConflict: "user_id" });
      if (error) throw error;
      return new Response(JSON.stringify({ current_streak: 1, longest_streak: 1 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const last = existing.last_active_date ? new Date(existing.last_active_date) : null;
    let current = existing.current_streak ?? 0;
    let stories = existing.total_stories_read ?? 0;
    const minutes = (existing.total_minutes ?? 0) + minutesRead;

    if (last) {
      const diffDays = Math.floor((today.getTime() - last.getTime()) / 86400000);
      if (diffDays === 0) {
        // Same day — only update totals
        stories += 1;
      } else if (diffDays === 1) {
        current += 1;
        stories += 1;
      } else {
        current = 1;
        stories += 1;
      }
    } else {
      current = 1;
      stories += 1;
    }

    const longest = Math.max(existing.longest_streak ?? 0, current);

    const { error } = await admin
      .from("reading_streaks")
      .update({
        current_streak: current,
        longest_streak: longest,
        last_active_date: todayStr,
        total_stories_read: stories,
        total_minutes: minutes,
      })
      .eq("user_id", userId);
    if (error) throw error;

    return new Response(
      JSON.stringify({ current_streak: current, longest_streak: longest, total_stories_read: stories }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("update-streak error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
