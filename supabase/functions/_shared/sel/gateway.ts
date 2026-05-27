// AI gateway for SEL agents.
// Priority order:
//   1) User-supplied API keys (loaded into AsyncLocalStorage by edge function).
//   2) Lovable AI Gateway (LOVABLE_API_KEY, free included usage).
//   3) OpenRouter free models (only if Lovable key is missing or returns 5xx).

import { getUserContext } from "../userKeys.ts";

const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");
const OPENROUTER_KEY = Deno.env.get("OPENROUTER_API_KEY");

const LOVABLE_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const REFERER = Deno.env.get("OPENROUTER_REFERER") ?? "https://lovable.dev";
const TITLE = Deno.env.get("OPENROUTER_TITLE") ?? "Starry Tales";

export interface AIChatOpts {
  model?: string;
  system: string;
  user: string;
  responseFormat?: "json_object" | "text";
  temperature?: number;
  maxTokens?: number;
}

export class AIGatewayError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Lovable AI Gateway models (preferred — free included usage).
const LOVABLE_MODELS = [
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
];

// OpenRouter free-tier fallback chain (used only if Lovable unavailable).
const OPENROUTER_FREE_MODELS = [
  "openai/gpt-oss-120b:free",
  "z-ai/glm-4.5-air:free",
  "meta-llama/llama-3.3-70b-instruct:free",
];

interface Provider {
  name: string;
  url: string;
  key: string;
  models: string[];
  extraHeaders?: Record<string, string>;
}

function providers(modelOverride?: string): Provider[] {
  const list: Provider[] = [];

  // 1) User-supplied API keys take priority — generation runs on user's own account.
  const ctx = getUserContext();
  if (ctx && ctx.textProviders.length > 0) {
    for (const up of ctx.textProviders) {
      list.push({
        name: up.name,
        url: up.url,
        key: up.key,
        models: up.models,
        extraHeaders: up.extraHeaders,
      });
    }
  }

  if (LOVABLE_KEY) {
    list.push({
      name: "lovable",
      url: LOVABLE_URL,
      key: LOVABLE_KEY,
      models: modelOverride && modelOverride.startsWith("google/")
        ? [modelOverride, ...LOVABLE_MODELS]
        : LOVABLE_MODELS,
    });
  }
  if (OPENROUTER_KEY) {
    list.push({
      name: "openrouter",
      url: OPENROUTER_URL,
      key: OPENROUTER_KEY,
      models: modelOverride && !modelOverride.startsWith("google/")
        ? [modelOverride, ...OPENROUTER_FREE_MODELS]
        : OPENROUTER_FREE_MODELS,
      extraHeaders: { "HTTP-Referer": REFERER, "X-Title": TITLE },
    });
  }
  return list;
}

const PER_CALL_TIMEOUT_MS = 25_000;

async function callOnce(provider: Provider, model: string, body: Record<string, unknown>): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PER_CALL_TIMEOUT_MS);
  try {
    return await fetch(provider.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${provider.key}`,
        "Content-Type": "application/json",
        ...(provider.extraHeaders ?? {}),
      },
      body: JSON.stringify({ ...body, model }),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function aiChat(opts: AIChatOpts): Promise<string> {
  const body: Record<string, unknown> = {
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ],
  };
  if (opts.temperature !== undefined) body.temperature = opts.temperature;
  body.max_tokens = opts.maxTokens ?? 3000;
  if (opts.responseFormat === "json_object") {
    body.response_format = { type: "json_object" };
  }

  const provs = providers(opts.model);
  if (provs.length === 0) {
    throw new AIGatewayError(500, "No AI provider configured (LOVABLE_API_KEY/OPENROUTER_API_KEY missing)");
  }

  let lastStatus = 500;
  let lastTxt = "";
  for (const p of provs) {
    for (const m of p.models) {
      console.log(`[sel/gateway] chat ${p.name}:${m}`);
      let r: Response;
      try {
        r = await callOnce(p, m, body);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[sel/gateway] ${p.name}:${m} threw (timeout/network): ${msg}`);
        lastStatus = 504;
        lastTxt = msg;
        continue;
      }
      if (r.ok) {
        const data = await r.json();
        console.log(`[sel/gateway] SUCCESS chat ${p.name}:${m}`);
        return data.choices?.[0]?.message?.content ?? "";
      }
      lastStatus = r.status;
      lastTxt = await r.text().catch(() => "");
      console.error(`[sel/gateway] ${p.name}:${m} -> ${r.status}: ${lastTxt.slice(0, 200)}`);
      if (r.status === 401 || r.status === 403) break;
      if (![402, 429, 404, 500, 502, 503, 504].includes(r.status)) break;
    }
  }
  throw new AIGatewayError(lastStatus, `AI gateway ${lastStatus}: ${lastTxt.slice(0, 200)}`);
}

export async function aiJson<T = unknown>(opts: AIChatOpts): Promise<T> {
  const body: Record<string, unknown> = {
    messages: [
      { role: "system", content: `${opts.system}\n\nReturn ONLY strict, parseable JSON. No markdown, no comments, no trailing commas, no missing values.` },
      { role: "user", content: opts.user },
    ],
    response_format: { type: "json_object" },
    max_tokens: opts.maxTokens ?? 6000,
  };
  if (opts.temperature !== undefined) body.temperature = opts.temperature;

  const provs = providers(opts.model);
  if (provs.length === 0) {
    throw new AIGatewayError(500, "No AI provider configured (LOVABLE_API_KEY/OPENROUTER_API_KEY missing)");
  }

  let lastStatus = 500;
  let lastTxt = "";
  let parseFailures = 0;
  for (const p of provs) {
    for (const m of p.models) {
      console.log(`[sel/gateway] json ${p.name}:${m}`);
      let r: Response;
      try {
        r = await callOnce(p, m, body);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[sel/gateway] json ${p.name}:${m} threw (timeout/network): ${msg}`);
        lastStatus = 504;
        lastTxt = msg;
        continue;
      }
      if (!r.ok) {
        lastStatus = r.status;
        lastTxt = await r.text().catch(() => "");
        console.error(`[sel/gateway] json ${p.name}:${m} -> ${r.status}: ${lastTxt.slice(0, 200)}`);
        if (r.status === 401 || r.status === 403) break;
        if (![402, 429, 404, 500, 502, 503, 504].includes(r.status)) break;
        continue;
      }
      const data = await r.json();
      const raw = data.choices?.[0]?.message?.content ?? "";
      const cleaned = raw.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
      try {
        console.log(`[sel/gateway] SUCCESS json ${p.name}:${m}`);
        return JSON.parse(cleaned) as T;
      } catch (e) {
        parseFailures++;
        lastStatus = 502;
        lastTxt = "AI returned invalid JSON";
        console.error(`[sel/gateway] invalid JSON ${p.name}:${m}`, {
          error: e instanceof Error ? e.message : String(e),
          preview: cleaned.slice(0, 300),
        });
      }
    }
  }
  console.error(`[sel/gateway] All providers failed for JSON. lastStatus=${lastStatus} parseFailures=${parseFailures}`);
  throw new AIGatewayError(lastStatus, lastTxt || "AI JSON gateway failed");
}
