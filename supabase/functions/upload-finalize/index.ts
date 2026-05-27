// upload-finalize — runs after the client successfully PUTs to temp-uploads.
// Pipeline: download -> magic-byte validation -> ClamAV scan -> move to target bucket
// -> log + delete temp -> return final path.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";
import { checkRateLimits, rateLimitResponse } from "../_shared/rateLimit.ts";
import { BUCKET_POLICIES, validateUpload } from "../_shared/uploadValidation.ts";
import { scanFile } from "../_shared/clamavScan.ts";

interface FinalizeBody {
  tempPath: string;     // path inside temp-uploads (must start with userId/)
  targetBucket: string; // user-files | drawing-entries | payment-proofs | video-uploads
  filename: string;
  declaredMime: string;
}

Deno.serve(async (req) => {
  const pf = handlePreflight(req); if (pf) return pf;
  const cors = buildCorsHeaders(req);
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "auth_required" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const { data: userData } = await sb.auth.getUser(auth.slice(7));
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "auth_required" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const id = `u:${user.id}`;
    const rl = await checkRateLimits(id, "upload-finalize", [
      { windowSec: 3600, max: 30 },
      { windowSec: 86400, max: 100, blockSec: 3600 },
    ]);
    if (!rl.allowed) return rateLimitResponse(rl, cors);

    const raw = await req.text();
    if (raw.length > 4096) {
      return new Response(JSON.stringify({ error: "payload_too_large" }), { status: 413, headers: { ...cors, "Content-Type": "application/json" } });
    }
    let body: FinalizeBody;
    try { body = JSON.parse(raw); }
    catch { return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } }); }

    const policy = BUCKET_POLICIES[body.targetBucket];
    if (!policy) {
      return new Response(JSON.stringify({ error: "invalid_bucket" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // Defence-in-depth: temp path MUST live inside the user's folder.
    if (!body.tempPath?.startsWith(`${user.id}/`)) {
      return new Response(JSON.stringify({ error: "forbidden_path" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ua = req.headers.get("user-agent")?.slice(0, 300) ?? null;

    // 1. Download the just-uploaded file from temp-uploads (service role)
    const { data: blob, error: dErr } = await sb.storage.from("temp-uploads").download(body.tempPath);
    if (dErr || !blob) {
      await sb.from("upload_security_logs").insert({
        user_id: user.id, ip, user_agent: ua, filename: body.filename, bucket: body.targetBucket,
        target_path: body.tempPath, action: "error", details: { stage: "download", error: dErr?.message ?? "missing" },
      });
      return new Response(JSON.stringify({ error: "temp_file_missing" }), { status: 404, headers: { ...cors, "Content-Type": "application/json" } });
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());

    // 2. Validate (magic bytes + ext + double-ext + size)
    const v = validateUpload({
      bucket: body.targetBucket,
      filename: body.filename,
      declaredMime: body.declaredMime,
      size: bytes.byteLength,
      bytes: bytes.subarray(0, Math.min(bytes.byteLength, 2048)),
    });
    if (!v.ok) {
      await sb.storage.from("temp-uploads").remove([body.tempPath]).catch(() => {});
      await sb.from("upload_security_logs").insert({
        user_id: user.id, ip, user_agent: ua, filename: body.filename, mime_declared: body.declaredMime,
        size_bytes: bytes.byteLength, bucket: body.targetBucket, target_path: body.tempPath,
        action: "rejected_validation", abuse_score: 5,
        details: { code: v.code, reason: v.reason, ...(v.details ?? {}) },
      });
      return new Response(JSON.stringify({ error: "content_rejected", code: v.code, reason: v.reason }),
        { status: 422, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // 3. Create scan job + scan
    const { data: jobRow } = await sb.from("file_scan_jobs").insert({
      user_id: user.id,
      temp_path: body.tempPath,
      target_bucket: body.targetBucket,
      target_path: "",
      declared_mime: v.detectedMime,
      size_bytes: bytes.byteLength,
      status: "scanning",
      attempts: 1,
    }).select("id").maybeSingle();
    const jobId = jobRow?.id ?? null;

    const scan = await scanFile(bytes, v.safeName);

    if (scan.verdict === "infected") {
      await sb.storage.from("temp-uploads").remove([body.tempPath]).catch(() => {});
      if (jobId) {
        await sb.from("file_scan_jobs").update({ status: "infected", scan_result: scan as unknown as Record<string, unknown> }).eq("id", jobId);
      }
      await sb.from("upload_security_logs").insert({
        user_id: user.id, ip, user_agent: ua, filename: v.safeName,
        mime_declared: body.declaredMime, mime_detected: v.detectedMime, extension: v.extension,
        size_bytes: bytes.byteLength, bucket: body.targetBucket, target_path: body.tempPath,
        action: "scanned_infected", scan_engine: scan.engine, scan_signature: scan.signature,
        abuse_score: 25, details: { scan },
      });
      // Auto-block the user from uploads for 24h after a malware hit
      await sb.from("rate_limit_blocks").insert({
        identifier: `u:${user.id}`, endpoint: "upload-finalize",
        reason: `malware: ${scan.signature ?? "unknown"}`,
        blocked_until: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      });
      return new Response(JSON.stringify({ error: "malware_detected", signature: scan.signature ?? null }),
        { status: 422, headers: { ...cors, "Content-Type": "application/json" } });
    }

    // 4. Move from temp-uploads -> targetBucket  (download + upload + remove)
    const finalPath = `${user.id}/${crypto.randomUUID()}.${v.extension}`;
    const { error: upErr } = await sb.storage.from(body.targetBucket).upload(finalPath, bytes, {
      contentType: v.detectedMime,
      upsert: false,
    });
    if (upErr) {
      console.error("final upload failed", upErr);
      await sb.storage.from("temp-uploads").remove([body.tempPath]).catch(() => {});
      if (jobId) await sb.from("file_scan_jobs").update({ status: "failed", error: upErr.message }).eq("id", jobId);
      await sb.from("upload_security_logs").insert({
        user_id: user.id, ip, user_agent: ua, filename: v.safeName,
        mime_detected: v.detectedMime, size_bytes: bytes.byteLength, bucket: body.targetBucket,
        target_path: finalPath, action: "error", details: { stage: "move", error: upErr.message },
      });
      return new Response(JSON.stringify({ error: "move_failed" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
    }
    await sb.storage.from("temp-uploads").remove([body.tempPath]).catch(() => {});

    if (jobId) {
      await sb.from("file_scan_jobs").update({
        status: "clean", target_path: finalPath, scan_result: scan as unknown as Record<string, unknown>,
      }).eq("id", jobId);
    }

    await sb.from("upload_security_logs").insert({
      user_id: user.id, ip, user_agent: ua, filename: v.safeName,
      mime_declared: body.declaredMime, mime_detected: v.detectedMime, extension: v.extension,
      size_bytes: bytes.byteLength, bucket: body.targetBucket, target_path: finalPath,
      action: "moved", scan_engine: scan.engine, details: { durationMs: scan.durationMs },
    });

    // 5. Issue signed download URL (10 min)
    const { data: signed } = await sb.storage.from(body.targetBucket).createSignedUrl(finalPath, 600);

    return new Response(JSON.stringify({
      bucket: body.targetBucket,
      path: finalPath,
      mime: v.detectedMime,
      signedUrl: signed?.signedUrl ?? null,
      scan: { verdict: scan.verdict, engine: scan.engine },
    }), { status: 200, headers: { ...cors, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("upload-finalize fatal", e);
    return new Response(JSON.stringify({ error: "server_error" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });
  }
});
