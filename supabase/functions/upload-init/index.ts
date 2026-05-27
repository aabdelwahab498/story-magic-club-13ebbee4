// upload-init — issues a signed upload URL into the temp-uploads bucket.
// Validates the requested bucket + size envelope before granting the URL.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";
import { checkRateLimits, identifierFromRequest, rateLimitResponse } from "../_shared/rateLimit.ts";
import { BUCKET_POLICIES, sanitiseFilename } from "../_shared/uploadValidation.ts";

interface InitBody {
  bucket: string;        // target bucket id (one of BUCKET_POLICIES)
  filename: string;
  size: number;
  declaredMime: string;
}

Deno.serve(async (req) => {
  const pf = handlePreflight(req); if (pf) return pf;
  const cors = buildCorsHeaders(req);
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "auth_required" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: userData, error: uErr } = await sb.auth.getUser(auth.slice(7));
    if (uErr || !userData.user) {
      return new Response(JSON.stringify({ error: "auth_required" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;

    // Rate limit: 30 init requests/hour and 100/day per user
    const id = `u:${userId}`;
    const rl = await checkRateLimits(id, "upload-init", [
      { windowSec: 3600, max: 30 },
      { windowSec: 86400, max: 100, blockSec: 3600 },
    ]);
    if (!rl.allowed) return rateLimitResponse(rl, cors);

    const raw = await req.text();
    if (raw.length > 4096) {
      return new Response(JSON.stringify({ error: "payload_too_large" }), { status: 413, headers: { ...cors, "Content-Type": "application/json" } });
    }
    let body: InitBody;
    try { body = JSON.parse(raw); }
    catch { return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } }); }

    const policy = BUCKET_POLICIES[body.bucket];
    if (!policy) {
      return new Response(JSON.stringify({ error: "invalid_bucket" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }
    if (!Number.isFinite(body.size) || body.size <= 0 || body.size > policy.maxBytes) {
      return new Response(JSON.stringify({ error: "size_out_of_range", max: policy.maxBytes }), { status: 413, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Daily byte quota (total across all moves) — 250 MB/day
    const { data: dailyData } = await sb.rpc("user_daily_upload_bytes", { _user_id: userId });
    const daily = Number(dailyData ?? 0);
    if (daily + body.size > 250 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "quota_reached", reason: "daily_bytes" }), { status: 402, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const safeName = sanitiseFilename(body.filename);
    const tempPath = `${userId}/${crypto.randomUUID()}-${safeName}`;
    const { data: signed, error: sErr } = await sb.storage
      .from("temp-uploads")
      .createSignedUploadUrl(tempPath);
    if (sErr || !signed) {
      console.error("createSignedUploadUrl failed", sErr);
      return new Response(JSON.stringify({ error: "init_failed" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }

    await sb.from("upload_security_logs").insert({
      user_id: userId,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
      filename: safeName,
      mime_declared: body.declaredMime?.slice(0, 100) ?? null,
      size_bytes: body.size,
      bucket: body.bucket,
      target_path: tempPath,
      action: "init",
    });

    return new Response(JSON.stringify({
      tempPath,
      token: signed.token,
      uploadUrl: signed.signedUrl,
    }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("upload-init error", e);
    return new Response(JSON.stringify({ error: "server_error" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
