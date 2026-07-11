// ============================================================================
// Shared n8n configuration loader.
// ----------------------------------------------------------------------------
// The admin dashboard writes the base webhook URL, per-workflow toggles, and
// the shared secret into two tables:
//   • `public.n8n_integration_settings` — base URL, per-workflow enabled flag,
//     per-workflow path (defaults `/export-txt`, `/export-audio`, `/export-pdf`).
//   • `public.n8n_integration_secrets` — private key/value; the secret is
//     stored under key `webhook_secret`. Only `service_role` can read it.
//
// Legacy env vars (`N8N_WEBHOOK_URL`, `N8N_WEBHOOK_SECRET`) are used as a
// fallback so nothing breaks during rollout.
// ============================================================================

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type N8nWorkflowKind = "txt" | "mp3" | "pdf";

export interface N8nWorkflowConfig {
  /** Full URL to POST for the workflow, or null when disabled/unconfigured. */
  url: string | null;
  /** Shared secret to send as `X-Webhook-Secret`, or empty string. */
  secret: string;
  /** Whether this workflow is enabled in the admin dashboard. */
  enabled: boolean;
  /** Base URL saved in settings (for diagnostics). */
  baseUrl: string | null;
}

interface SettingsRow {
  webhook_base_url: string | null;
  txt_enabled: boolean;
  mp3_enabled: boolean;
  pdf_enabled: boolean;
  txt_path: string;
  mp3_path: string;
  pdf_path: string;
}

const SETTINGS_TABLE = "n8n_integration_settings";
const SECRETS_TABLE = "n8n_integration_secrets";
const SECRET_KEY = "webhook_secret";

/**
 * Fetch the n8n configuration for a single workflow kind.
 * Falls back to env vars when the DB row is missing or the URL is blank.
 * Must be called with a service-role client.
 */
export async function getN8nConfig(
  admin: SupabaseClient,
  kind: N8nWorkflowKind,
): Promise<N8nWorkflowConfig> {
  const envUrl = Deno.env.get("N8N_WEBHOOK_URL") ?? "";
  const envSecret = Deno.env.get("N8N_WEBHOOK_SECRET") ?? "";

  let base: string = envUrl;
  let enabled = true;
  let path: string =
    kind === "txt" ? "/export-txt" : kind === "mp3" ? "/export-audio" : "/export-pdf";

  try {
    const { data } = await admin
      .from(SETTINGS_TABLE)
      .select("webhook_base_url, txt_enabled, mp3_enabled, pdf_enabled, txt_path, mp3_path, pdf_path")
      .limit(1)
      .maybeSingle<SettingsRow>();
    if (data) {
      if (data.webhook_base_url) base = data.webhook_base_url;
      if (kind === "txt") {
        enabled = data.txt_enabled;
        path = data.txt_path || path;
      } else if (kind === "mp3") {
        enabled = data.mp3_enabled;
        path = data.mp3_path || path;
      } else {
        enabled = data.pdf_enabled;
        path = data.pdf_path || path;
      }
    }
  } catch (err) {
    console.warn("[n8nConfig] failed to load settings, using env fallback:", (err as Error).message);
  }

  let secret = envSecret;
  try {
    const { data } = await admin
      .from(SECRETS_TABLE)
      .select("value")
      .eq("key", SECRET_KEY)
      .maybeSingle<{ value: string }>();
    if (data?.value) secret = data.value;
  } catch {
    /* secret table unreachable — use env */
  }

  const baseTrimmed = (base || "").trim().replace(/\/$/, "");
  const pathTrimmed = path.startsWith("/") ? path : `/${path}`;
  const url = baseTrimmed && enabled ? `${baseTrimmed}${pathTrimmed}` : null;

  return { url, secret, enabled, baseUrl: baseTrimmed || null };
}

/**
 * Convenience: build a service-role client (used by helpers that don't already
 * hold one).
 */
export function serviceRoleClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}
