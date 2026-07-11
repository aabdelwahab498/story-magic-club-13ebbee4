// ============================================================================
// admin-n8n-settings
// ----------------------------------------------------------------------------
// Admin-only management API for the n8n integration used by the export
// workflows (TXT / MP3 / PDF). All actions require the caller to hold the
// `admin` role in `public.user_roles`.
//
// Actions (POST body { action, ... }):
//   • "get"          → returns the current settings row (secret is NEVER
//                       returned, only a boolean `webhook_secret_set`).
//   • "update"       → updates base URL, per-workflow enabled flags, and
//                       per-workflow paths.
//   • "set-secret"   → stores the shared webhook secret in the private
//                       `n8n_integration_secrets` table (service-role only).
//                       Pass `{ secret: "..." }` or `{ secret: null }` to clear.
//   • "test"         → POSTs a minimal ping to the configured webhook path
//                       for a given workflow kind and records the result.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SECRET_KEY = "webhook_secret";
const TEST_TIMEOUT_MS = 10_000;

type WorkflowKind = "txt" | "mp3" | "pdf";

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  const pre = handlePreflight(req);
  if (pre) return pre;

  const json = (body: unknown, status = 200): Response =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  const fail = (code: string, status = 400, extra: Record<string, unknown> = {}) =>
    json({ success: false, error: code, ...extra }, status);
  const pathFor = (kind: WorkflowKind, row: { txt_path: string; mp3_path: string; pdf_path: string }) =>
    kind === "txt" ? row.txt_path : kind === "mp3" ? row.mp3_path : row.pdf_path;

  if (req.method !== "POST") return fail("method_not_allowed", 405);

  // ── Auth ─────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return fail("unauthorized", 401);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return fail("unauthorized", 401);
  const userId = userData.user.id;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // Admin gate — has_role() is SECURITY DEFINER
  const { data: isAdminRaw, error: roleErr } = await admin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (roleErr || !isAdminRaw) return fail("forbidden", 403);

  // ── Body ─────────────────────────────────────────────────────────────
  let body: {
    action?: string;
    webhook_base_url?: string | null;
    txt_enabled?: boolean;
    mp3_enabled?: boolean;
    pdf_enabled?: boolean;
    txt_path?: string;
    mp3_path?: string;
    pdf_path?: string;
    story_webhook_url?: string | null;
    story_enabled?: boolean;
    secret?: string | null;
    kind?: WorkflowKind;
  };
  try {
    body = await req.json();
  } catch {
    return fail("invalid_json", 400);
  }

  const action = body.action;
  if (!action) return fail("action_required", 400);

  // Helper: load the singleton settings row (create one on the fly if missing).
  const loadRow = async () => {
    const { data } = await admin
      .from("n8n_integration_settings")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (data) return data;
    const { data: created } = await admin
      .from("n8n_integration_settings")
      .insert({})
      .select("*")
      .single();
    return created!;
  };

  const secretExists = async () => {
    const { data } = await admin
      .from("n8n_integration_secrets")
      .select("key")
      .eq("key", SECRET_KEY)
      .maybeSingle();
    return !!data;
  };

  // ── GET ──────────────────────────────────────────────────────────────
  if (action === "get") {
    const row = await loadRow();
    const hasSecret = await secretExists();
    return json({
      success: true,
      settings: {
        ...row,
        webhook_secret_set: hasSecret,
      },
    });
  }

  // ── UPDATE ───────────────────────────────────────────────────────────
  if (action === "update") {
    const row = await loadRow();
    const patch: Record<string, unknown> = { updated_by: userId };
    if (body.webhook_base_url !== undefined) {
      const url = (body.webhook_base_url ?? "").trim();
      if (url && !/^https:\/\//i.test(url)) return fail("url_must_be_https", 400);
      patch.webhook_base_url = url || null;
    }
    if (typeof body.txt_enabled === "boolean") patch.txt_enabled = body.txt_enabled;
    if (typeof body.mp3_enabled === "boolean") patch.mp3_enabled = body.mp3_enabled;
    if (typeof body.pdf_enabled === "boolean") patch.pdf_enabled = body.pdf_enabled;
    for (const k of ["txt_path", "mp3_path", "pdf_path"] as const) {
      if (typeof body[k] === "string") {
        const v = (body[k] as string).trim();
        if (!v.startsWith("/")) return fail("path_must_start_with_slash", 400, { field: k });
        patch[k] = v;
      }
    }
    if (body.story_webhook_url !== undefined) {
      const url = (body.story_webhook_url ?? "").trim();
      if (url && !/^https:\/\//i.test(url)) return fail("story_url_must_be_https", 400);
      patch.story_webhook_url = url || null;
    }
    if (typeof body.story_enabled === "boolean") patch.story_enabled = body.story_enabled;


    const { data: updated, error } = await admin
      .from("n8n_integration_settings")
      .update(patch)
      .eq("id", row.id)
      .select("*")
      .single();
    if (error) return fail("update_failed", 500, { message: error.message });

    const hasSecret = await secretExists();
    return json({
      success: true,
      settings: { ...updated, webhook_secret_set: hasSecret },
    });
  }

  // ── SET SECRET ───────────────────────────────────────────────────────
  if (action === "set-secret") {
    const secret = body.secret;
    if (secret === null || secret === "") {
      await admin.from("n8n_integration_secrets").delete().eq("key", SECRET_KEY);
      await admin
        .from("n8n_integration_settings")
        .update({ webhook_secret_set: false, updated_by: userId })
        .neq("id", "00000000-0000-0000-0000-000000000000");
      return json({ success: true, cleared: true });
    }
    if (typeof secret !== "string" || secret.length < 8) {
      return fail("secret_too_short", 400);
    }
    if (secret.length > 512) return fail("secret_too_long", 400);

    // Upsert into private table
    const { error: upsertErr } = await admin
      .from("n8n_integration_secrets")
      .upsert({ key: SECRET_KEY, value: secret, updated_at: new Date().toISOString() });
    if (upsertErr) return fail("secret_write_failed", 500, { message: upsertErr.message });

    await admin
      .from("n8n_integration_settings")
      .update({ webhook_secret_set: true, updated_by: userId })
      .neq("id", "00000000-0000-0000-0000-000000000000");
    return json({ success: true });
  }

  // ── TEST ─────────────────────────────────────────────────────────────
  if (action === "test") {
    const kind = body.kind;
    if (!kind || !["txt", "mp3", "pdf"].includes(kind)) return fail("invalid_kind", 400);

    const row = await loadRow();
    if (!row.webhook_base_url) return fail("no_base_url", 400);

    const { data: secretRow } = await admin
      .from("n8n_integration_secrets")
      .select("value")
      .eq("key", SECRET_KEY)
      .maybeSingle();
    const secret = (secretRow?.value as string | undefined) ?? "";

    const url = `${row.webhook_base_url.replace(/\/$/, "")}${pathFor(kind, row)}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TEST_TIMEOUT_MS);
    let status = "failed";
    let message = "";
    let httpStatus: number | null = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json", "X-Webhook-Secret": secret },
        body: JSON.stringify({ ping: true, kind, ts: Date.now() }),
      });
      httpStatus = res.status;
      status = res.ok ? "ok" : "failed";
      message = res.ok ? `HTTP ${res.status}` : `HTTP ${res.status}`;
    } catch (err) {
      status = "failed";
      message = (err as Error).message || "network_error";
    } finally {
      clearTimeout(timer);
    }

    await admin
      .from("n8n_integration_settings")
      .update({
        last_tested_at: new Date().toISOString(),
        last_test_status: status,
        last_test_message: `[${kind}] ${message}`,
        updated_by: userId,
      })
      .eq("id", row.id);

    return json({ success: status === "ok", status, http_status: httpStatus, message, tested_url: url });
  }

  // ── TEST STORY WEBHOOK ───────────────────────────────────────────────
  if (action === "test-story") {
    const row = await loadRow();
    const url = (row.story_webhook_url as string | null) ?? "";
    if (!url) return fail("no_story_webhook_url", 400);

    const { data: secretRow } = await admin
      .from("n8n_integration_secrets")
      .select("value")
      .eq("key", SECRET_KEY)
      .maybeSingle();
    const secret = (secretRow?.value as string | undefined) ?? "";

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TEST_TIMEOUT_MS);
    let status = "failed";
    let message = "";
    let httpStatus: number | null = null;
    try {
      const res = await fetch(url, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json", "X-Webhook-Secret": secret },
        body: JSON.stringify({ ping: true, kind: "story", message: "test", ts: Date.now() }),
      });
      httpStatus = res.status;
      status = res.ok ? "ok" : "failed";
      message = `HTTP ${res.status}`;
    } catch (err) {
      message = (err as Error).message || "network_error";
    } finally {
      clearTimeout(timer);
    }

    await admin
      .from("n8n_integration_settings")
      .update({
        last_tested_at: new Date().toISOString(),
        last_test_status: status,
        last_test_message: `[story] ${message}`,
        updated_by: userId,
      })
      .eq("id", row.id);

    return json({ success: status === "ok", status, http_status: httpStatus, message, tested_url: url });
  }

  return fail("unknown_action", 400);
});

