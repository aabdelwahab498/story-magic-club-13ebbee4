// batch-download-stories — Bundle a child's (or user's) AI stories into a single ZIP
// containing requested formats (pdf, mp3, txt, epub). Stores under user_id/job_id.zip
// in `story-bundles` bucket and returns a signed URL.

import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { checkRateLimits, rateLimitResponse } from "../_shared/rateLimit.ts";

const ALLOWED_FORMATS = new Set(["pdf", "mp3", "txt", "epub"]);
const MAX_STORIES = 50;

interface ReqBody { childId?: string; formats: string[] }

function safeName(s: string): string {
  return (s || "story").replace(/[^a-zA-Z0-9-_\u0600-\u06FF]+/g, "_").slice(0, 60) || "story";
}

function buildTxt(title: string, pages: { text: string }[]): string {
  return `${title}\n${"=".repeat(title.length)}\n\n${pages.map((p, i) => `Page ${i + 1}\n\n${p.text}`).join("\n\n---\n\n")}\n`;
}

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
    const cl = Number(req.headers.get("content-length") || "0");
    if (cl > 4_096) return json({ error: "payload_too_large" }, 413);

    const raw = (await req.json().catch(() => ({}))) as Partial<ReqBody>;
    const childId = typeof raw.childId === "string" ? raw.childId.slice(0, 64) : null;
    const formats = Array.isArray(raw.formats)
      ? raw.formats.filter((f) => typeof f === "string" && ALLOWED_FORMATS.has(f))
      : [];
    if (formats.length === 0) return json({ error: "no_formats" }, 400);

    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (!userId) return json({ error: "unauthorized" }, 401);

    const rl = await checkRateLimits(`u:${userId}`, "batch-download-stories", [
      { windowSec: 300, max: 2 },
      { windowSec: 86400, max: 10 },
    ]);
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: paidAllowed } = await admin.rpc("has_paid_feature", {
      _user_id: userId,
      _feature: "pdf",
    });
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (!paidAllowed && !isAdmin) {
      return json({ error: "subscription_required", feature: "pdf", blocked: true }, 200);
    }

    // Fetch stories
    let q = supabase
      .from("ai_story_history")
      .select("id, title, pages, generated_story, language, pdf_url, audio_url, child_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(MAX_STORIES);
    if (childId) q = q.eq("child_id", childId);
    const { data: stories, error: sErr } = await q;
    if (sErr) return json({ error: "fetch_failed" }, 500);
    if (!stories || stories.length === 0) return json({ error: "no_stories" }, 404);

    // Create job row
    const { data: jobRow } = await admin
      .from("batch_export_jobs")
      .insert({
        user_id: userId,
        child_id: childId,
        formats,
        status: "running",
        total: stories.length,
        completed: 0,
      })
      .select("id")
      .single();
    const jobId = jobRow?.id as string;

    const zip = new JSZip();
    let completed = 0;

    for (const s of stories) {
      const folder = zip.folder(safeName(s.title || `story-${s.id.slice(0, 6)}`))!;

      type Page = { text: string; image_url?: string | null };
      let pages: Page[] = [];
      if (Array.isArray(s.pages) && s.pages.length > 0) {
        pages = (s.pages as Page[]).map((p) => ({
          text: String((p as { text?: string; content?: string }).text ?? (p as { content?: string }).content ?? "").trim(),
          image_url: p.image_url ?? null,
        })).filter((p) => p.text.length > 0);
      } else {
        const txt = String((s.generated_story as { text?: string } | null)?.text ?? "");
        pages = txt.split(/\n{2,}/).map((t) => ({ text: t.trim() })).filter((p) => p.text.length > 0);
      }

      // TXT
      if (formats.includes("txt") && pages.length > 0) {
        folder.file(`${safeName(s.title || "story")}.txt`, buildTxt(s.title || "Story", pages));
      }

      // PDF
      if (formats.includes("pdf") && s.pdf_url) {
        try {
          const r = await fetch(s.pdf_url);
          if (r.ok) folder.file(`${safeName(s.title || "story")}.pdf`, new Uint8Array(await r.arrayBuffer()));
        } catch (_) { /* skip */ }
      }

      // MP3
      if (formats.includes("mp3") && s.audio_url) {
        try {
          const r = await fetch(s.audio_url);
          if (r.ok) folder.file(`${safeName(s.title || "story")}.mp3`, new Uint8Array(await r.arrayBuffer()));
        } catch (_) { /* skip */ }
      }

      // EPUB — try to fetch existing
      if (formats.includes("epub")) {
        try {
          const path = `${userId}/${safeName(s.title || "story")}-${s.id.slice(0, 8)}.epub`;
          const { data: dl } = await admin.storage.from("story-epubs").download(path);
          if (dl) folder.file(`${safeName(s.title || "story")}.epub`, new Uint8Array(await dl.arrayBuffer()));
        } catch (_) { /* skip */ }
      }

      completed++;
      if (completed % 5 === 0 && jobId) {
        await admin.from("batch_export_jobs").update({ completed }).eq("id", jobId);
      }
    }

    const bundle = await zip.generateAsync({ type: "uint8array" });
    const bundlePath = `${userId}/${jobId || crypto.randomUUID()}.zip`;
    const { error: upErr } = await admin.storage
      .from("story-bundles")
      .upload(bundlePath, bundle, { contentType: "application/zip", upsert: true });
    if (upErr) {
      if (jobId) await admin.from("batch_export_jobs").update({ status: "failed", error: upErr.message }).eq("id", jobId);
      return json({ error: "upload_failed" }, 500);
    }

    const { data: signed } = await admin.storage
      .from("story-bundles")
      .createSignedUrl(bundlePath, 3600);

    if (jobId) {
      await admin.from("batch_export_jobs").update({
        status: "completed",
        completed,
        bundle_path: bundlePath,
        bundle_url: signed?.signedUrl ?? null,
      }).eq("id", jobId);
    }

    return json({
      jobId,
      bundleUrl: signed?.signedUrl ?? null,
      total: stories.length,
      bytes: bundle.length,
    });
  } catch (e) {
    console.error("[batch] unexpected", e);
    return new Response(JSON.stringify({ error: "internal_error", message: String((e as Error)?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
