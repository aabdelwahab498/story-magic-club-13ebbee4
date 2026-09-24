// generate-classic-illustrations — generates illustrations for the classic
// AI Storyteller flow (non-SEL). Returns one cover for everyone, additional
// scene images only for paid subscribers (illustrations feature).
import { buildCorsHeaders, handlePreflight } from "../_shared/cors.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Pollinations.ai — free image generation, no API key required.
const POLLINATIONS_BASE = "https://image.pollinations.ai/prompt";

interface ReqBody {
  scenes: string[]; // short scene descriptions, scene[0] is the cover
  character?: string; // e.g. "wise wizard"
  theme?: string;
  ageId?: string;
  style?: string;
  language?: string;
}

function stableSeed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 1_000_000;
}

async function tryGenerate(prompt: string, seed: number): Promise<{ ok: true; dataUrl: string } | { ok: false; status: number; body: string }> {
  try {
    const url = `${POLLINATIONS_BASE}/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&safe=true&model=flux&seed=${seed}`;
    const r = await fetch(url);
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      console.error(`[classic-illust] pollinations status=${r.status} body=${txt.slice(0, 300)}`);
      return { ok: false, status: r.status, body: txt.slice(0, 300) };
    }
    const buf = new Uint8Array(await r.arrayBuffer());
    const mime = r.headers.get("content-type") ?? "image/jpeg";
    let binary = "";
    for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
    const b64 = btoa(binary);
    return { ok: true, dataUrl: `data:${mime};base64,${b64}` };
  } catch (e) {
    return { ok: false, status: 0, body: e instanceof Error ? e.message : "unknown" };
  }
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  const pre = handlePreflight(req);
  if (pre) return pre;

  // Body size guard (~16KB)
  const cl = Number(req.headers.get("content-length") || "0");
  if (cl > 16_384) return json({ error: "payload_too_large" }, 413, corsHeaders);

  try {
    const raw = (await req.json().catch(() => ({}))) as ReqBody & { trigger?: string; triggerSource?: string };
    if ((raw as { trigger?: string })?.trigger !== "user") {
      console.error("[classic-illust] BLOCKED non-user trigger", { trigger: (raw as { trigger?: string })?.trigger, source: (raw as { triggerSource?: string })?.triggerSource });
      return json({ error: "trigger_required", message: "generate-classic-illustrations requires { trigger: 'user' }" }, 403, corsHeaders);
    }
    if (!Array.isArray(raw?.scenes) || raw.scenes.length === 0) {
      return json({ error: "missing_scenes" }, 400, corsHeaders);
    }
    const body: ReqBody = {
      scenes: raw.scenes.slice(0, 6).map((s) => (typeof s === "string" ? s.slice(0, 400) : "")).filter(Boolean),
      character: typeof raw.character === "string" ? raw.character.slice(0, 120) : undefined,
      theme: typeof raw.theme === "string" ? raw.theme.slice(0, 80) : undefined,
      ageId: typeof raw.ageId === "string" ? raw.ageId.slice(0, 10) : undefined,
      style: typeof raw.style === "string" ? raw.style.slice(0, 200) : undefined,
      language: typeof raw.language === "string" ? raw.language.slice(0, 5) : undefined,
    };
    if (body.scenes.length === 0) return json({ error: "missing_scenes" }, 400, corsHeaders);

    // Auth (optional — guests get a cover only too)
    const authHeader = req.headers.get("Authorization") ?? "";
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await sb.auth.getUser();
    const userId = userData?.user?.id ?? null;

    // Credits: authenticated users consume 10 illustration credits per
    // story (regardless of scene count, capped at 8). Guests get cover only.
    let canFullSet = false;
    let creditsCharged = false;
    if (userId) {
      const { consumeIllustrationCredits, hasValidImageByok } = await import("../_shared/quota.ts");
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: isAdmin } = await admin.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      });
      if (isAdmin) {
        canFullSet = true;
      } else {
        const debit = await consumeIllustrationCredits(userId, 10);
        if (debit.success) {
          canFullSet = true;
          creditsCharged = true;
        } else if (await hasValidImageByok(userId)) {
          canFullSet = true;
        } else {
          return json({
            error: "illustration_credits_exhausted",
            reason: "insufficient_credits",
            balance: debit.balance,
            cost: 10,
            message: "Not enough illustration credits.",
          }, 402, corsHeaders);
        }
      }
    }
    void creditsCharged;

    const style = body.style ?? "soft watercolor children's book illustration, gentle pastel palette, warm lighting";
    const characterDesc = body.character
      ? `LOCKED CHARACTER REFERENCE: ${body.character}. Keep the exact same child/character design, outfit, colors, age, hair, proportions, and signature item in every scene.`
      : "";
    const themeDesc = body.theme ? `Theme: ${body.theme}.` : "";
    const ageDesc = body.ageId ? `For ages ${body.ageId}.` : "";

    // Free guest gets cover only; paid users get up to 8 scenes.
    const targetCount = canFullSet ? Math.min(body.scenes.length, 8) : 1;
    const targets = body.scenes.slice(0, targetCount);

    const results: { index: number; imageUrl: string | null; status: string }[] = [];
    for (let i = 0; i < targets.length; i++) {
      const scene = targets[i];
      const prompt =
        `${style}. ${characterDesc} ${themeDesc} ${ageDesc} ` +
        `Scene: ${scene}. ` +
        `Child-safe, friendly, full scene composition, no text in image, no logos, no watermark.`;
      const seed = stableSeed(`${body.character ?? ""}|${body.theme ?? ""}|${i}`);
      const gen = await tryGenerate(prompt, seed);
      if (!gen.ok) {
        results.push({ index: i, imageUrl: null, status: "failed" });
        continue;
      }
      // Return as data URL — keeps function self-contained for guests too.
      results.push({ index: i, imageUrl: gen.dataUrl, status: "ready" });
    }

    return json({
      illustrations: results,
      gated: !canFullSet && body.scenes.length > 1,
      tier: canFullSet ? "paid" : userId ? "free" : "guest",
    }, 200, corsHeaders);
  } catch (e) {
    console.error("generate-classic-illustrations error", e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500, corsHeaders);
  }
});

function json(obj: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
