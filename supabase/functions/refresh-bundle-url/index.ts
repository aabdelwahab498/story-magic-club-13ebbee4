// refresh-bundle-url — Mint a fresh 1-hour signed URL for an existing batch ZIP
// without rebuilding the bundle. Verifies the requester owns the job.

import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SIGNED_URL_TTL = 3600;

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  const pre = handlePreflight(req);
  if (pre) return pre;

  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const raw = (await req.json().catch(() => ({}))) as { jobId?: string };
    const jobId = typeof raw.jobId === "string" ? raw.jobId.slice(0, 64) : "";
    if (!jobId) return json({ error: "missing_jobId" }, 400);

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return json({ error: "unauthorized" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: job, error: jErr } = await admin
      .from("batch_export_jobs")
      .select("id, user_id, status, bundle_path")
      .eq("id", jobId)
      .maybeSingle();
    if (jErr || !job) return json({ error: "job_not_found" }, 404);
    if (job.user_id !== userId) return json({ error: "forbidden" }, 403);
    if (job.status !== "completed" || !job.bundle_path) {
      return json({ error: "bundle_not_ready" }, 409);
    }

    const { data: signed, error: sErr } = await admin.storage
      .from("story-bundles")
      .createSignedUrl(job.bundle_path, SIGNED_URL_TTL);
    if (sErr || !signed) return json({ error: "sign_failed" }, 500);

    await admin
      .from("batch_export_jobs")
      .update({ bundle_url: signed.signedUrl })
      .eq("id", jobId);

    return json({ bundleUrl: signed.signedUrl, expiresIn: SIGNED_URL_TTL });
  } catch (e) {
    console.error("[refresh-bundle-url] unexpected", e);
    return json({ error: "internal_error", message: String((e as Error)?.message ?? e) }, 500);
  }
});
