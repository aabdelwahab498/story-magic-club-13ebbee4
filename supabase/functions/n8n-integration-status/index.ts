// ============================================================================
// n8n-integration-status  —  Public read-only status for the export bar.
// ----------------------------------------------------------------------------
// Returns which export workflows are currently configured to use n8n vs the
// local fallback. NEVER returns the webhook URL or secret — only booleans and
// the last-test summary that the admin already made visible in the dashboard.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SECRET_KEY = "webhook_secret";

interface WorkflowStatus {
  /** True when the admin toggled this workflow on. */
  enabled: boolean;
  /** True when base URL is set (server-side), regardless of enabled flag. */
  configured: boolean;
  /** True when the export will actually go through n8n (enabled + configured). */
  using_n8n: boolean;
}

interface StatusResponse {
  success: true;
  secret_set: boolean;
  workflows: {
    txt: WorkflowStatus;
    mp3: WorkflowStatus;
    pdf: WorkflowStatus;
  };
  last_tested_at: string | null;
  last_test_status: string | null;
}

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  const pre = handlePreflight(req);
  if (pre) return pre;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // Fall back to env vars when the DB row is missing so the badge shows the
  // pre-DB integration path too.
  const envUrl = (Deno.env.get("N8N_WEBHOOK_URL") ?? "").trim();
  const envSecret = (Deno.env.get("N8N_WEBHOOK_SECRET") ?? "").trim();

  const { data: row } = await admin
    .from("n8n_integration_settings")
    .select("webhook_base_url, txt_enabled, mp3_enabled, pdf_enabled, last_tested_at, last_test_status")
    .limit(1)
    .maybeSingle();

  const configuredUrl = (row?.webhook_base_url ?? "").trim() || envUrl;
  const configured = !!configuredUrl;

  const { data: secretRow } = await admin
    .from("n8n_integration_secrets")
    .select("key")
    .eq("key", SECRET_KEY)
    .maybeSingle();
  const secretSet = !!secretRow || !!envSecret;

  const wf = (enabled: boolean): WorkflowStatus => ({
    enabled,
    configured,
    using_n8n: enabled && configured,
  });

  const response: StatusResponse = {
    success: true,
    secret_set: secretSet,
    workflows: {
      txt: wf(row?.txt_enabled ?? true),
      mp3: wf(row?.mp3_enabled ?? true),
      pdf: wf(row?.pdf_enabled ?? true),
    },
    last_tested_at: row?.last_tested_at ?? null,
    last_test_status: row?.last_test_status ?? null,
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
