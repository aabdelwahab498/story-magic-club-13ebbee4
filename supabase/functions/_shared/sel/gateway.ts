// AI text gateway — Google AI Studio (Gemini) direct.
//
// Priority order:
//   1) User-supplied API keys (BYOK, loaded via AsyncLocalStorage).
//   2) Google AI Studio using GEMINI_API_KEY.
//        - primary: gemini-2.5-flash
//        - fallback: gemini-1.5-flash
//
// Uses Google's OpenAI-compatible endpoint so the rest of the codebase
// keeps the same chat/completions shape.

import { getUserContext } from "../userKeys.ts";

const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

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

// Gemini models used when no explicit override is passed.
const GEMINI_MODELS = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];

interface Provider {
  name: string;
  url: string;
  key: string;
  models: string[];
  extraHeaders?: Record<string, string>;
}

function normalizeModel(m: string): string {
  // Strip vendor prefix (e.g. "google/gemini-2.5-flash") — Gemini API expects bare model id.
  return m.replace(/^google\//, "");
}

function providers(modelOverride?: string): Provider[] {
  const list: Provider[] = [];

  // 1) BYOK — user-supplied keys take priority.
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

  if (GEMINI_KEY) {
    const models = modelOverride
      ? [normalizeModel(modelOverride), ...GEMINI_MODELS.filter((m) => m !== normalizeModel(modelOverride))]
      : GEMINI_MODELS;
    list.push({ name: "gemini", url: GEMINI_URL, key: GEMINI_KEY, models });
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
    throw new AIGatewayError(500, "No AI provider configured (GEMINI_API_KEY missing)");
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
    throw new AIGatewayError(500, "No AI provider configured (GEMINI_API_KEY missing)");
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
