// batch-download-stories — Bundle a user's AI stories into a ZIP.
// Supports: cancellation (cancel_requested flag), per-story failure tracking,
// and retry mode via storyIds[]. Returns jobId immediately; processing runs
// in the background and publishes progress on public.batch_export_jobs.

import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import JSZip from "https://esm.sh/jszip@3.10.1";
import { checkRateLimits, rateLimitResponse } from "../_shared/rateLimit.ts";

const ALLOWED_FORMATS = new Set(["pdf", "mp3", "txt", "epub"]);
const MAX_STORIES = 100;
const SIGNED_URL_TTL = 3600;

interface ReqBody {
  childId?: string;
  formats: string[];
  /** Optional explicit subset (retry mode) */
  storyIds?: string[];
}

// deno-lint-ignore no-explicit-any
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

function safeName(s: string): string {
  return (s || "story").replace(/[^a-zA-Z0-9-_\u0600-\u06FF]+/g, "_").slice(0, 60) || "story";
}

function buildTxt(title: string, pages: { text: string }[]): string {
  return `${title}\n${"=".repeat(title.length)}\n\n${pages.map((p, i) => `Page ${i + 1}\n\n${p.text}`).join("\n\n---\n\n")}\n`;
}

interface StoryRow {
  id: string; title: string | null;
  pages: unknown; generated_story: unknown;
  language: string | null; pdf_url: string | null;
  audio_url: string | null; child_id: string | null;
}

interface FailedItem {
  storyId: string;
  title: string;
  format: string;
  reason: string;
}

async function isCancelled(admin: SupabaseClient, jobId: string): Promise<boolean> {
  const { data } = await admin
    .from("batch_export_jobs")
    .select("cancel_requested")
    .eq("id", jobId)
    .maybeSingle();
  return Boolean(data?.cancel_requested);
}

async function processBatch(
  admin: SupabaseClient,
  jobId: string,
  userId: string,
  stories: StoryRow[],
  formats: string[],
) {
  const zip = new JSZip();
  let completed = 0;
  const failed: FailedItem[] = [];

  const pushFail = (s: StoryRow, format: string, reason: string) =>
    failed.push({
      storyId: s.id,
      title: s.title || `story-${s.id.slice(0, 6)}`,
      format,
      reason: reason.slice(0, 240),
    });

  try {
    for (const s of stories) {
      if (await isCancelled(admin, jobId)) {
        await admin.from("batch_export_jobs").update({
          status: "cancelled",
          completed,
          failed_items: failed,
        }).eq("id", jobId);
        return;
      }

      const folder = zip.folder(safeName(s.title || `story-${s.id.slice(0, 6)}`))!;
      type Page = { text: string; image_url?: string | null };
      let pages: Page[] = [];
      if (Array.isArray(s.pages) && (s.pages as unknown[]).length > 0) {
        pages = (s.pages as Page[]).map((p) => ({
          text: String((p as { text?: string; content?: string }).text ?? (p as { content?: string }).content ?? "").trim(),
          image_url: p.image_url ?? null,
        })).filter((p) => p.text.length > 0);
      } else {
        const txt = String((s.generated_story as { text?: string } | null)?.text ?? "");
        pages = txt.split(/\n{2,}/).map((t) => ({ text: t.trim() })).filter((p) => p.text.length > 0);
      }

      let anyAdded = false;

      if (formats.includes("txt")) {
        if (pages.length > 0) {
          folder.file(`${safeName(s.title || "story")}.txt`, buildTxt(s.title || "Story", pages));
          anyAdded = true;
        } else {
          pushFail(s, "txt", "empty_story");
        }
      }
      if (formats.includes("pdf")) {
        if (!s.pdf_url) {
          pushFail(s, "pdf", "no_pdf_generated");
        } else {
          try {
            const r = await fetch(s.pdf_url);
            if (!r.ok) throw new Error(`http_${r.status}`);
            folder.file(`${safeName(s.title || "story")}.pdf`, new Uint8Array(await r.arrayBuffer()));
            anyAdded = true;
          } catch (e) { pushFail(s, "pdf", String((e as Error)?.message ?? e)); }
        }
      }
      if (formats.includes("mp3")) {
        if (!s.audio_url) {
          pushFail(s, "mp3", "no_audio_generated");
        } else {
          try {
            const r = await fetch(s.audio_url);
            if (!r.ok) throw new Error(`http_${r.status}`);
            folder.file(`${safeName(s.title || "story")}.mp3`, new Uint8Array(await r.arrayBuffer()));
            anyAdded = true;
          } catch (e) { pushFail(s, "mp3", String((e as Error)?.message ?? e)); }
        }
      }
      if (formats.includes("epub")) {
        try {
          const path = `${userId}/${safeName(s.title || "story")}-${s.id.slice(0, 8)}.epub`;
          const { data: dl, error } = await admin.storage.from("story-epubs").download(path);
          if (error || !dl) throw new Error(error?.message || "epub_not_found");
          folder.file(`${safeName(s.title || "story")}.epub`, new Uint8Array(await dl.arrayBuffer()));
          anyAdded = true;
        } catch (e) { pushFail(s, "epub", String((e as Error)?.message ?? e)); }
      }

      if (!anyAdded) {
        // Remove empty folder so the zip stays clean
        delete (zip.files as Record<string, unknown>)[`${safeName(s.title || `story-${s.id.slice(0, 6)}`)}/`];
      }

      completed++;
      await admin.from("batch_export_jobs").update({
        completed,
        failed_items: failed,
      }).eq("id", jobId);
    }

    const bundle = await zip.generateAsync({ type: "uint8array" });
    const bundlePath = `${userId}/${jobId}.zip`;
    const { error: upErr } = await admin.storage
      .from("story-bundles")
      .upload(bundlePath, bundle, { contentType: "application/zip", upsert: true });
    if (upErr) throw new Error(upErr.message);

    const { data: signed } = await admin.storage
      .from("story-bundles")
      .createSignedUrl(bundlePath, SIGNED_URL_TTL);

    await admin.from("batch_export_jobs").update({
      status: "completed",
      completed,
      failed_items: failed,
      bundle_path: bundlePath,
      bundle_url: signed?.signedUrl ?? null,
    }).eq("id", jobId);
  } catch (e) {
    console.error("[batch] processing failed", e);
    await admin.from("batch_export_jobs").update({
      status: "failed",
      failed_items: failed,
      error: String((e as Error)?.message ?? e).slice(0, 500),
    }).eq("id", jobId);
  }
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
    if (cl > 16_384) return json({ error: "payload_too_large" }, 413);

    const raw = (await req.json().catch(() => ({}))) as Partial<ReqBody>;
    const childId = typeof raw.childId === "string" ? raw.childId.slice(0, 64) : null;
    const formats = Array.isArray(raw.formats)
      ? raw.formats.filter((f) => typeof f === "string" && ALLOWED_FORMATS.has(f))
      : [];
    const storyIds = Array.isArray(raw.storyIds)
      ? raw.storyIds.filter((s): s is string => typeof s === "string" && s.length <= 64).slice(0, MAX_STORIES)
      : null;
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
      { windowSec: 300, max: 4 },
      { windowSec: 86400, max: 20 },
    ]);
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: paidAllowed } = await admin.rpc("has_paid_feature", {
      _user_id: userId, _feature: "pdf",
    });
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: userId, _role: "admin",
    });
    if (!paidAllowed && !isAdmin) {
      return json({ error: "subscription_required", feature: "pdf", blocked: true }, 200);
    }

    let q = supabase
      .from("ai_story_history")
      .select("id, title, pages, generated_story, language, pdf_url, audio_url, child_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(MAX_STORIES);
    if (storyIds && storyIds.length > 0) q = q.in("id", storyIds);
    else if (childId) q = q.eq("child_id", childId);
    const { data: stories, error: sErr } = await q;
    if (sErr) return json({ error: "fetch_failed" }, 500);
    if (!stories || stories.length === 0) return json({ error: "no_stories" }, 404);

    const { data: jobRow, error: jErr } = await admin
      .from("batch_export_jobs")
      .insert({
        user_id: userId, child_id: childId, formats,
        status: "running", total: stories.length, completed: 0,
        failed_items: [], cancel_requested: false,
      })
      .select("id")
      .single();
    if (jErr || !jobRow) return json({ error: "job_create_failed" }, 500);
    const jobId = jobRow.id as string;

    const work = processBatch(admin, jobId, userId, stories as StoryRow[], formats);
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      EdgeRuntime.waitUntil(work);
    } else {
      work.catch((e) => console.error("[batch] bg error", e));
    }

    return json({ jobId, total: stories.length, status: "running" });
  } catch (e) {
    console.error("[batch] unexpected", e);
    return new Response(JSON.stringify({ error: "internal_error", message: String((e as Error)?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
