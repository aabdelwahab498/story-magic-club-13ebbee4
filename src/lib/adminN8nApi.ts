// ============================================================================
// Admin n8n Integration API — talks to `admin-n8n-settings` edge function.
// ============================================================================
import { supabase } from "@/integrations/supabase/client";

export type N8nWorkflowKind = "txt" | "mp3" | "pdf";

export interface N8nSettings {
  id: string;
  webhook_base_url: string | null;
  webhook_secret_set: boolean;
  txt_enabled: boolean;
  mp3_enabled: boolean;
  pdf_enabled: boolean;
  txt_path: string;
  mp3_path: string;
  pdf_path: string;
  story_webhook_url: string | null;
  story_enabled: boolean;
  last_tested_at: string | null;
  last_test_status: string | null;
  last_test_message: string | null;
  updated_at: string;
}

async function call<T>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T & { success?: boolean; error?: string }>(
    "admin-n8n-settings",
    { body: { action, ...extra } },
  );
  if (error) throw new Error(error.message);
  if (!data || (data as { success?: boolean }).success === false) {
    throw new Error((data as { error?: string })?.error ?? "unknown_error");
  }
  return data as T;
}

export async function getN8nSettings(): Promise<N8nSettings> {
  const { settings } = await call<{ settings: N8nSettings }>("get");
  return settings;
}

export interface UpdateN8nInput {
  webhook_base_url?: string | null;
  txt_enabled?: boolean;
  mp3_enabled?: boolean;
  pdf_enabled?: boolean;
  txt_path?: string;
  mp3_path?: string;
  pdf_path?: string;
  story_webhook_url?: string | null;
  story_enabled?: boolean;
}

export async function updateN8nSettings(patch: UpdateN8nInput): Promise<N8nSettings> {
  const { settings } = await call<{ settings: N8nSettings }>("update", patch as Record<string, unknown>);
  return settings;
}


export async function updateN8nSecret(secret: string | null): Promise<void> {
  await call("set-secret", { secret });
}

export interface N8nTestResult {
  status: "ok" | "failed";
  http_status: number | null;
  message: string;
  tested_url: string;
}

export async function testN8nWorkflow(kind: N8nWorkflowKind): Promise<N8nTestResult> {
  return call<N8nTestResult>("test", { kind });
}
