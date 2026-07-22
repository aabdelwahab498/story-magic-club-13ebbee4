// Free-trial story (anonymous, 3-page preview, one-shot per browser).
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

export async function generateTrialStory(_input: TrialInput): Promise<TrialStoryResponse> {
  throw new Error("Guest trials are not yet migrated to Backend Core");
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
  _input: {
    pages: { index: number; illustrationPrompt: string; emotionTag?: string }[];
    childName?: string;
    theme?: string;
  },
  _meta: { trigger?: "user" | "auto"; source?: string } = {},
): Promise<TrialIllustrateResponse> {
  throw new Error("Guest trial illustrations are not yet migrated to Backend Core");
}

// ---- Step 3: trial PDF (anonymous, no auth, returns base64) ----
export interface TrialPdfResponse {
  pdfBase64: string;
  mimeType: string;
  pageCount: number;
  sizeBytes: number;
}

export const prepareTrialPdfDownloadTarget = prepareDownloadTarget;

export async function generateTrialPdf(_input: {
  title: string;
  pages: { index: number; text: string; emotionTag?: string; imageUrl?: string | null }[];
  childName?: string;
  selStatement?: string;
}): Promise<TrialPdfResponse> {
  throw new Error("Guest trial PDF exports are not yet migrated to Backend Core");
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


