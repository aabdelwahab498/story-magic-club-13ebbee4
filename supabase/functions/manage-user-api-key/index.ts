// Secure management endpoint for BYOK (Bring Your Own API Key).
// Handles save / delete / validate actions. The plaintext key never leaves
// this function: it is encrypted with AES-GCM (see _shared/byokCrypto.ts) and
// only ciphertext + a 4-char preview are written to the database.
//
// Tier gating: only `pro_creator` and `elite_publisher` subscribers may save
// personal keys. Free / lower tiers receive a 403.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://esm.sh/zod@3.23.8";
import { encryptApiKey } from "../_shared/byokCrypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const ELIGIBLE_TIERS = new Set(["pro_creator", "elite_publisher"]);
const ALLOWED_PROVIDERS = new Set(["openai", "openrouter"]);

const SaveSchema = z.object({
  action: z.literal("save"),
  provider: z.enum(["openai", "openrouter"]),
  apiKey: z.string().trim().min(20).max(512),
  label: z.string().trim().max(40).optional(),
});

const DeleteSchema = z.object({
  action: z.literal("delete"),
  provider: z.enum(["openai", "openrouter"]),
});

const ToggleSchema = z.object({
  action: z.literal("toggle"),
  provider: z.enum(["openai", "openrouter"]),
  enabled: z.boolean(),
});

const BodySchema = z.union([SaveSchema, DeleteSchema, ToggleSchema]);

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function userHasEligibleTier(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from("user_subscriptions")
    .select("plan_tier, status, expires_at")
    .eq("user_id", userId)
    .eq("status", "active");
  if (error) {
    console.error("[manage-user-api-key] tier lookup failed", error);
    return false;
  }
  const now = Date.now();
  return (data ?? []).some(
    (s: any) =>
      ELIGIBLE_TIERS.has(s.plan_tier) &&
      (!s.expires_at || new Date(s.expires_at).getTime() > now),
  );
}

async function validateKey(
  provider: "openai" | "openrouter",
  apiKey: string,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const url =
    provider === "openai"
      ? "https://api.openai.com/v1/models"
      : "https://openrouter.ai/api/v1/models";
  try {
    const r = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (r.ok) return { ok: true, status: r.status };
    return { ok: false, status: r.status, error: `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  // Auth: require a real user JWT (verify_jwt is true by default for new functions).
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return jsonResponse({ error: "unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return jsonResponse({ error: "unauthorized" }, 401);
  const userId = userData.user.id;

  let parsed;
  try {
    parsed = BodySchema.safeParse(await req.json());
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }
  if (!parsed.success) {
    return jsonResponse(
      { error: "invalid_request", details: parsed.error.flatten() },
      400,
    );
  }
  const body = parsed.data;

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  if (body.action === "save") {
    if (!ALLOWED_PROVIDERS.has(body.provider)) {
      return jsonResponse({ error: "provider_not_allowed" }, 400);
    }
    const eligible = await userHasEligibleTier(admin, userId);
    if (!eligible) {
      return jsonResponse(
        {
          error: "tier_required",
          message:
            "Personal API keys are available on the Pro Creator and Elite Publisher plans.",
        },
        403,
      );
    }

    const validation = await validateKey(body.provider, body.apiKey);
    if (!validation.ok) {
      return jsonResponse(
        { error: "invalid_api_key", details: validation.error ?? validation.status },
        400,
      );
    }

    const { ciphertext, iv, last4, fingerprint } = await encryptApiKey(body.apiKey);

    // Upsert by (user_id, provider) — one personal key per provider.
    const { error: deleteErr } = await admin
      .from("user_api_keys")
      .delete()
      .eq("user_id", userId)
      .eq("provider", body.provider);
    if (deleteErr) {
      console.error("[manage-user-api-key] delete prior failed", deleteErr);
      return jsonResponse({ error: "save_failed" }, 500);
    }

    const { error: insertErr } = await admin.from("user_api_keys").insert({
      user_id: userId,
      provider: body.provider,
      label: body.label ?? null,
      // api_key (legacy plaintext) left null going forward.
      api_key: "",
      api_key_ciphertext: ciphertext,
      api_key_iv: iv,
      key_last4: last4,
      key_fingerprint: fingerprint,
      encryption_version: 1,
      enabled: true,
      capabilities: ["text", "image"],
      last_validated_at: new Date().toISOString(),
      validation_status: "ok",
    });
    if (insertErr) {
      console.error("[manage-user-api-key] insert failed", insertErr);
      return jsonResponse({ error: "save_failed" }, 500);
    }
    return jsonResponse({ ok: true, provider: body.provider, last4, fingerprint });
  }

  if (body.action === "delete") {
    const { error } = await admin
      .from("user_api_keys")
      .delete()
      .eq("user_id", userId)
      .eq("provider", body.provider);
    if (error) return jsonResponse({ error: "delete_failed" }, 500);
    return jsonResponse({ ok: true });
  }

  if (body.action === "toggle") {
    const { error } = await admin
      .from("user_api_keys")
      .update({ enabled: body.enabled })
      .eq("user_id", userId)
      .eq("provider", body.provider);
    if (error) return jsonResponse({ error: "toggle_failed" }, 500);
    return jsonResponse({ ok: true, enabled: body.enabled });
  }

  return jsonResponse({ error: "unknown_action" }, 400);
});
