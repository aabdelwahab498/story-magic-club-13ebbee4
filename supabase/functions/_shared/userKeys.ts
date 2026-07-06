// User-supplied API keys helper.
// Loads keys for a given user (via service role), builds Provider definitions
// usable by sel/gateway.ts, and exposes an AsyncLocalStorage context so calls
// deep in the pipeline (planner/writer/quality) can transparently pick them up.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { AsyncLocalStorage } from "node:async_hooks";
import { decryptApiKey } from "./byokCrypto.ts";

// Only these tiers may use a personal API key in the generation pipeline.
const BYOK_ELIGIBLE_TIERS = new Set(["pro_creator", "elite_publisher"]);

export interface UserProvider {
  source: "user";
  name: string;        // e.g. "user:openai:abc1"
  url: string;
  key: string;
  models: string[];
  extraHeaders?: Record<string, string>;
}

export interface UserAIContext {
  userId: string;
  textProviders: UserProvider[];
  imageKeys: UserImageKey[];
}

export interface UserImageKey {
  provider: "openai" | "google" | "stability" | "replicate" | "custom";
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

export const userAIStorage = new AsyncLocalStorage<UserAIContext>();

export function getUserContext(): UserAIContext | undefined {
  return userAIStorage.getStore();
}

interface KeyRow {
  provider: string;
  api_key: string | null;
  api_key_ciphertext: string | null;
  api_key_iv: string | null;
  base_url: string | null;
  text_model: string | null;
  image_model: string | null;
  capabilities: string[] | null;
  enabled: boolean;
  label: string | null;
}

const TEXT_DEFAULTS: Record<string, { url: string; model: string; headers?: Record<string, string> }> = {
  openai: { url: "https://api.openai.com/v1/chat/completions", model: "gpt-4o-mini" },
  openrouter: {
    url: "https://openrouter.ai/api/v1/chat/completions",
    model: "openai/gpt-4o-mini",
    headers: { "HTTP-Referer": "https://lovable.dev", "X-Title": "Starry Tales" },
  },
  google: {
    // Google's OpenAI-compatible endpoint
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    model: "gemini-2.5-flash",
  },
  anthropic: {
    // We expose anthropic via openai-compatible proxy? Not officially supported here, but
    // many users route anthropic through OpenRouter. Keep entry for completeness.
    url: "https://api.anthropic.com/v1/chat/completions",
    model: "claude-3-5-sonnet-latest",
  },
};

async function userIsByokEligible(
  admin: SupabaseClient<any, "public", any>,
  userId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("user_subscriptions")
    .select("plan_tier, status, expires_at")
    .eq("user_id", userId)
    .eq("status", "active");
  if (error) {
    console.error("[userKeys] tier lookup failed", error);
    return false;
  }
  const now = Date.now();
  return (data ?? []).some(
    (s: any) =>
      BYOK_ELIGIBLE_TIERS.has(s.plan_tier) &&
      (!s.expires_at || new Date(s.expires_at).getTime() > now),
  );
}

async function resolvePlaintextKey(row: KeyRow): Promise<string | null> {
  // Prefer encrypted ciphertext (new path). Fall back to legacy plaintext only
  // if the row was created before encryption was rolled out.
  if (row.api_key_ciphertext && row.api_key_iv) {
    try {
      return await decryptApiKey(row.api_key_ciphertext, row.api_key_iv);
    } catch (e) {
      console.error("[userKeys] decrypt failed", e);
      return null;
    }
  }
  return row.api_key && row.api_key.length > 0 ? row.api_key : null;
}

export async function loadUserAIContext(userId: string): Promise<UserAIContext> {
  const empty: UserAIContext = { userId, textProviders: [], imageKeys: [] };
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Tier gate: only Pro Creator / Elite Publisher may inject personal keys.
    if (!(await userIsByokEligible(supabase, userId))) {
      return empty;
    }

    const { data, error } = await supabase
      .from("user_api_keys")
      .select(
        "provider, api_key, api_key_ciphertext, api_key_iv, base_url, text_model, image_model, capabilities, enabled, label",
      )
      .eq("user_id", userId)
      .eq("enabled", true);
    if (error) {
      console.error("[userKeys] load failed", error);
      return empty;
    }
    const rows = (data ?? []) as KeyRow[];

    const textProviders: UserProvider[] = [];
    const imageKeys: UserImageKey[] = [];

    for (const row of rows) {
      const caps = row.capabilities ?? ["text", "image"];
      const label = row.label ? row.label.replace(/[^a-z0-9_-]/gi, "").slice(0, 12) : "";
      const plain = await resolvePlaintextKey(row);
      if (!plain) continue;

      // text
      if (caps.includes("text")) {
        const def = TEXT_DEFAULTS[row.provider];
        if (def) {
          textProviders.push({
            source: "user",
            name: `user:${row.provider}${label ? `:${label}` : ""}`,
            url: row.base_url || def.url,
            key: plain,
            models: [row.text_model || def.model],
            extraHeaders: def.headers,
          });
        } else if (row.provider === "custom" && row.base_url && row.text_model) {
          textProviders.push({
            source: "user",
            name: `user:custom${label ? `:${label}` : ""}`,
            url: row.base_url,
            key: plain,
            models: [row.text_model],
          });
        }
      }

      // image
      if (caps.includes("image")) {
        if (row.provider === "openai" || row.provider === "google" || row.provider === "stability" || row.provider === "replicate" || row.provider === "custom") {
          imageKeys.push({
            provider: row.provider,
            apiKey: plain,
            model: row.image_model ?? undefined,
            baseUrl: row.base_url ?? undefined,
          });
        }
      }
    }

    return { userId, textProviders, imageKeys };
  } catch (e) {
    console.error("[userKeys] unexpected", e);
    return empty;
  }
}

/** Run an async block with the given user's AI context available to gateway/image helpers. */
export async function withUserAI<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  const ctx = await loadUserAIContext(userId);
  return await userAIStorage.run(ctx, fn);
}
