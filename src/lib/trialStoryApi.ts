// Free-trial story (anonymous, 3-page preview, one-shot per browser).
import { supabase } from "@/integrations/supabase/client";

import {
  downloadBlob,
  prepareDownloadTarget,
  type PreparedDownloadTarget,
} from "@/lib/browserDownload";

export interface TrialStoryPage {
  index: number;
  text: string;
  emotionTag: string;
  illustrationPrompt: string;
  imageUrl: string | null;
}

export interface TrialStoryResponse {
  teaser: true;
  title: string;
  pages: TrialStoryPage[];
  totalPages: number;
  shownPages: number;
  sel_outcome?: { skill: string; emotion: string; statement: string };
}

const FP_KEY = "starry-tales-trial-fp";

/** Cheap, stable browser fingerprint. Optional — backend no longer enforces it,
 *  but we still send it (best-effort) for monitoring/analytics. Never throws. */
export async function getBrowserFingerprint(): Promise<string> {
  try {
    const cached = localStorage.getItem(FP_KEY);
    if (cached) return cached;

    const parts: string[] = [
      navigator.userAgent || "",
      navigator.language || "",
      `${screen.width}x${screen.height}x${screen.colorDepth}`,
      String(new Date().getTimezoneOffset()),
      String(navigator.hardwareConcurrency ?? 0),
      // @ts-expect-error optional
      String(navigator.deviceMemory ?? 0),
    ];

    try {
      const c = document.createElement("canvas");
      c.width = 200; c.height = 40;
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.textBaseline = "top";
        ctx.font = "14px Arial";
        ctx.fillStyle = "#f60";
        ctx.fillRect(0, 0, 100, 20);
        ctx.fillStyle = "#069";
        ctx.fillText("starry-tales-fp", 2, 2);
        parts.push(c.toDataURL().slice(-80));
      }
    } catch { /* ignore */ }

    const text = parts.join("|");
    const buf = new TextEncoder().encode(text);
    const hashBuf = await crypto.subtle.digest("SHA-256", buf);
    const hash = Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    try { localStorage.setItem(FP_KEY, hash); } catch { /* ignore */ }
    return hash;
  } catch {
    return "anon-" + Math.random().toString(36).slice(2, 14);
  }
}

export interface TrialInput {
  childName: string;
  age: number;
  theme: string;
  language?: string;
  customPrompt?: string;
}


export class TrialRateLimitedError extends Error {
  retryAfter: number;
  reason: "rate_limited" | "blocked";
  constructor(retryAfter: number, reason: "rate_limited" | "blocked" = "rate_limited") {
    super("trial_rate_limited");
    this.name = "TrialRateLimitedError";
    this.retryAfter = retryAfter;
    this.reason = reason;
  }
}

export class TrialContentRejectedError extends Error {
  userMessage: string;
  constructor(msg: string) {
    super("trial_content_rejected");
    this.name = "TrialContentRejectedError";
    this.userMessage = msg;
  }
}

export class TrialServerError extends Error {
  userMessage: string;
  requestId?: string;
  status: number;
  constructor(status: number, msg: string, requestId?: string) {
    super(msg);
    this.name = "TrialServerError";
    this.userMessage = msg;
    this.status = status;
    this.requestId = requestId;
  }
}

// Najmah NestJS public trial endpoint (no Supabase auth, intentionally public).
const NAJMAH_TRIAL_URL = "https://najmah-api.nextnext-gen.com/api/v2/stories/trial";

interface NajmahErrorBody {
  success?: boolean;
  statusCode?: number;
  error?: string;
  code?: string;
  message?: string;
  trace_id?: string;
  requestId?: string;
  retry_after?: number;
}

export async function generateTrialStory(input: TrialInput): Promise<TrialStoryResponse> {
  // Backend DTO fields only — no fingerprint, no auth header.
  const body: Record<string, unknown> = {
    childName: input.childName,
    age: input.age,
    theme: input.theme,
  };
  if (input.language) body.language = input.language;
  if (input.customPrompt) body.selGoal = input.customPrompt;

  let res: Response;
  try {
    res = await fetch(NAJMAH_TRIAL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new TrialServerError(0, e instanceof Error ? e.message : "Network error.");
  }

  if (!res.ok) {
    let errBody: NajmahErrorBody = {};
    try { errBody = await res.clone().json(); } catch { /* ignore */ }
    const message = errBody.message ?? "Failed to generate trial story.";
    const requestId = errBody.requestId ?? errBody.trace_id;

    if (res.status === 429) {
      const retry = Number(errBody.retry_after ?? res.headers.get("retry-after") ?? 60);
      throw new TrialRateLimitedError(retry, errBody.error === "blocked" ? "blocked" : "rate_limited");
    }
    const code = String(errBody.code ?? errBody.error ?? "");
    if (/content_rejected|content_not_allowed|unsafe_content|moderation/i.test(code)) {
      throw new TrialContentRejectedError(message);
    }
    throw new TrialServerError(res.status, message, requestId);
  }

  return (await res.json()) as TrialStoryResponse;
}
// ---- Step 2: trial illustrations (anonymous, no auth) ----
export interface TrialIllustration {
  index: number;
  imageUrl: string | null; // data:image/... URL
  status: "ready" | "failed";
}

export interface TrialIllustrateResponse {
  illustrations: TrialIllustration[];
  total: number;
  ready: number;
}

export async function generateTrialIllustrations(
  input: {
    pages: { index: number; illustrationPrompt: string; emotionTag?: string }[];
    childName?: string;
    theme?: string;
  },
  meta: { trigger?: "user" | "auto"; source?: string } = {},
): Promise<TrialIllustrateResponse> {
  const trigger = meta.trigger ?? "auto";
  const source = meta.source ?? "unknown";
  if (trigger !== "user") {
    console.error("[trial-illustrate] BLOCKED auto/unattributed invoke", { source, stack: new Error().stack });
    throw new Error("trial-illustrate must be user-triggered (pass { trigger: 'user' })");
  }
  console.info("[trial-illustrate] user-triggered invoke", { source, pages: input.pages.length });
  const { data, error } = await supabase.functions.invoke("trial-illustrate", {
    body: { ...input, trigger: "user", triggerSource: source },
  });
  if (error) {
    console.warn("[trial-illustrate] soft-fail:", error);
    return { illustrations: [], total: 0, ready: 0 };
  }
  return data as TrialIllustrateResponse;
}

// ---- Step 3: trial PDF (anonymous, no auth, returns base64) ----
export interface TrialPdfResponse {
  pdfBase64: string;
  mimeType: string;
  pageCount: number;
  sizeBytes: number;
}

export const prepareTrialPdfDownloadTarget = prepareDownloadTarget;

export async function generateTrialPdf(input: {
  title: string;
  pages: { index: number; text: string; emotionTag?: string; imageUrl?: string | null }[];
  childName?: string;
  selStatement?: string;
}): Promise<TrialPdfResponse> {
  const { data, error } = await supabase.functions.invoke("trial-pdf", { body: input });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    let msg = "Could not build PDF.";
    if (ctx instanceof Response) {
      try {
        const body = await ctx.clone().json();
        if (body?.message) msg = body.message;
      } catch { /* ignore */ }
    }
    throw new Error(msg);
  }
  return data as TrialPdfResponse;
}


/** Trigger a browser download of the base64 PDF returned by generateTrialPdf.
 *  Falls back to opening the PDF in a new tab when the current context is a
 *  sandboxed iframe (e.g. the Lovable preview) that blocks direct downloads. */
export function downloadTrialPdf(
  pdfBase64: string,
  filename = "my-story.pdf",
  target?: PreparedDownloadTarget,
) {
  const bin = atob(pdfBase64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: "application/pdf" });
  downloadBlob(blob, filename, target);
}


// ---- Resume handoff: persist trial inputs so the user can continue after sign-up ----
const RESUME_KEY = "starry-tales-trial-resume";

export interface TrialResume {
  childName: string;
  age: number;
  theme: string;
  language?: string;
  savedAt: number;
}

export function saveTrialResume(input: TrialInput) {
  try {
    const payload: TrialResume = { ...input, savedAt: Date.now() };
    localStorage.setItem(RESUME_KEY, JSON.stringify(payload));
  } catch { /* ignore */ }
}

export function loadTrialResume(): TrialResume | null {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TrialResume;
    // Expire after 24h
    if (Date.now() - (parsed.savedAt ?? 0) > 24 * 60 * 60 * 1000) {
      localStorage.removeItem(RESUME_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearTrialResume() {
  try { localStorage.removeItem(RESUME_KEY); } catch { /* ignore */ }
}


