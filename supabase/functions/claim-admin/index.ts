import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { checkRateLimits, rateLimitResponse } from "../_shared/rateLimit.ts";

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  const pre = handlePreflight(req);
  if (pre) return pre;
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const MASTER_KEY = Deno.env.get("ADMIN_MASTER_KEY");

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    null;
  const userAgent = req.headers.get("user-agent") || null;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  const audit = async (
    userId: string | null,
    email: string | null,
    success: boolean
  ) => {
    try {
      await admin.from("admin_claim_attempts").insert({
        user_id: userId,
        email,
        success,
        ip,
        user_agent: userAgent,
      });
    } catch (_) {
      // never block the response on audit failure
    }
  };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      await audit(null, null, false);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!MASTER_KEY) {
      return new Response(
        JSON.stringify({ error: "Server not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      await audit(null, null, false);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const userId = claimsData.claims.sub as string;
    const email = (claimsData.claims.email as string | undefined) ?? null;

    // Rate limit by user AND by IP. Block 24h after 5 attempts in an hour.
    const rlUser = await checkRateLimits(`u:${userId}`, "claim-admin", [
      { windowSec: 3600, max: 5, blockSec: 86400 },
    ]);
    if (!rlUser.allowed) {
      await audit(userId, email, false);
      return rateLimitResponse(rlUser, corsHeaders);
    }
    if (ip) {
      const rlIp = await checkRateLimits(`ip:${ip}`, "claim-admin", [
        { windowSec: 3600, max: 10, blockSec: 86400 },
      ]);
      if (!rlIp.allowed) {
        await audit(userId, email, false);
        return rateLimitResponse(rlIp, corsHeaders);
      }
    }

    const body = await req.json().catch(() => ({}));
    const masterKey = typeof body?.masterKey === "string" ? body.masterKey : "";

    if (masterKey.length !== MASTER_KEY.length) {
      await audit(userId, email, false);
      return new Response(
        JSON.stringify({ error: "Invalid master key" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    let mismatch = 0;
    for (let i = 0; i < masterKey.length; i++) {
      mismatch |= masterKey.charCodeAt(i) ^ MASTER_KEY.charCodeAt(i);
    }
    if (mismatch !== 0) {
      await audit(userId, email, false);
      return new Response(
        JSON.stringify({ error: "Invalid master key" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: insertErr } = await admin
      .from("user_roles")
      .insert({ user_id: userId, role: "admin" });

    if (insertErr && !String(insertErr.message).toLowerCase().includes("duplicate")) {
      await audit(userId, email, false);
      return new Response(
        JSON.stringify({ error: insertErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await audit(userId, email, true);
    return new Response(
      JSON.stringify({ success: true, message: "You are now an admin." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
