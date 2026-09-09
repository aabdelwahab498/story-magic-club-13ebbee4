// Phase 3/4 — client wrappers for SEL story orchestration + illustration.
import { supabase } from "@/integrations/supabase/client";


export interface SelStoryPage {
  index: number;
  text: string;
  emotionTag: string;
  illustrationPrompt: string;
  bibliotherapyStage?: "identification" | "catharsis" | "insight" | "universalization";
  imageUrl?: string;
  // Cinematic multimedia director fields (optional)
  visualPrompt?: string;
  animationPrompt?: string;
  voiceOver?: string;
  dialogue?: string;
  soundEffects?: string;
  backgroundMusic?: string;
  imagePrompt?: string;
  videoPrompt?: string;
}

export interface SelStoryResponse {
  story_id?: string;
  title: string;
  pages: SelStoryPage[];
  sel_outcome: { skill: string; emotion: string; statement: string };
  character_visual_hash: string;
  age_band: "3-5" | "6-8" | "9-12";
  quality: { total: number; passed: boolean; scores: Record<string, number>; notes?: string };
  safety: { passed: boolean; violations: { rule: string; evidence: string }[] };
  length: { passed: boolean; pageCount: number };
  passed: boolean;
  regeneration_count: number;
  blueprint?: Record<string, unknown>;
}

export interface ComposeStoryInput {
  childProfileId?: string | null;
  childName: string;
  age: number;
  theme: string;
  emotionalFocus?: string[];
  language?: string;
  customPrompt?: string;
  mode?: "plan" | "full";
  presetBlueprint?: Record<string, unknown>;
}

export interface SelPlanResponse {
  requestId: string;
  mode: "plan";
  blueprint: Record<string, unknown> & {
    title: string;
    hero: { name: string; sense?: string; problem?: string; engine?: string; charm?: string };
    mentor?: { name: string; role: string };
    companion?: { name: string; role: string };
    acts: { act1_normalWorld: string; act2_disturbance: string; act3_attempts: string[]; act4_resolution: string };
    selOutcome: { skill: string; emotion: string; statement: string };
  };
  age_band: "3-5" | "6-8" | "9-12";
}

/**
 * Error thrown when compose-story returns a standardized `{success:false}`
 * payload (HTTP 200). Carries the user-friendly message and a machine code
 * so callers can branch (e.g. redirect to /auth on "unauthorized").
 */
export class ComposeStoryError extends Error {
  constructor(
    public code: string,
    public friendlyMessage: string,
  ) {
    super(friendlyMessage);
    this.name = "ComposeStoryError";
  }
}


/**
 * Adapter boundary — currently backed by the `compose-story` edge function
 * (Supabase). Swap the body here when Backend Core takes over; the UI only
 * knows about these signatures.
 */
function assertComposeOk(data: unknown) {
  const body = data as { success?: boolean; code?: string; message?: string } | null;
  if (body && body.success === false) {
    throw new ComposeStoryError(
      body.code ?? "compose_failed",
      body.message ?? "Unable to generate the story right now.",
    );
  }
}

/** Maps the AIStoryteller form payload to the verified backend-core CreateStoryRequestDto. */
export function toCreateStoryRequest(input: ComposeStoryInput): CreateStoryRequestDto {
  const childId = input.childProfileId ?? "";
  if (!childId) {
    throw new ComposeStoryError(
      "child_required",
      "Please select a child profile before generating a story.",
    );
  }
  const selGoal =
    (input.emotionalFocus ?? []).filter(Boolean).join(", ") ||
    input.customPrompt ||
    input.theme;
  return {
    childId,
    theme: input.theme,
    selGoal,
    language: input.language ?? "en",
    preferences: {
      childName: input.childName,
      age: input.age,
      emotionalFocus: input.emotionalFocus ?? [],
      ...(input.customPrompt ? { customPrompt: input.customPrompt } : {}),
      ...(input.presetBlueprint ? { presetBlueprint: input.presetBlueprint } : {}),
    },
  };
}

function ageBandFor(age: number): SelStoryResponse["age_band"] {
  if (age <= 5) return "3-5";
  if (age <= 8) return "6-8";
  return "9-12";
}

/** Transforms a completed backend-core story into the shape AIStoryteller expects. */
export function fromBackendStory(
  story: StoryResponseDto,
  input: ComposeStoryInput,
): SelStoryResponse {
  const meta = (story.metadata ?? {}) as Record<string, unknown>;
  const pages: SelStoryPage[] = (story.pages ?? []).map((p, i) => ({
    index: typeof p.pageNumber === "number" ? p.pageNumber : i + 1,
    text: String(p.text ?? ""),
    emotionTag: String((p as { emotionTag?: string }).emotionTag ?? ""),
    illustrationPrompt: String((p as { illustrationPrompt?: string }).illustrationPrompt ?? ""),
    imageUrl: (p as { illustrationUrl?: string }).illustrationUrl,
  }));
  const selGoal = String(meta.selGoal ?? "");
  return {
    story_id: story.id,
    title: story.title ?? String(meta.theme ?? input.theme),
    pages,
    sel_outcome: { skill: selGoal, emotion: selGoal, statement: selGoal },
    character_visual_hash: String(meta.characterVisualHash ?? ""),
    age_band: ageBandFor(input.age),
    quality: { total: 0, passed: true, scores: {} },
    safety: { passed: true, violations: [] },
    length: { passed: true, pageCount: pages.length },
    passed: true,
    regeneration_count: 0,
    blueprint: (meta.blueprint as Record<string, unknown>) ?? undefined,
  };
}

/** Plan preview — backend-core `POST /api/v2/stories/plan`. */
export async function planSelStory(input: ComposeStoryInput): Promise<SelPlanResponse> {
  const blueprint = await storiesApi.planStory(toCreateStoryRequest(input));
  return {
    requestId: String((blueprint as { requestId?: string }).requestId ?? ""),
    mode: "plan",
    blueprint: blueprint as SelPlanResponse["blueprint"],
    age_band: ageBandFor(input.age),
  };
}

/**
 * Full compose — backend-core `POST /api/v2/stories`, then polls
 * `GET /api/v2/stories/:id` until the story reaches a terminal status.
 */
export async function composeSelStory(input: ComposeStoryInput): Promise<SelStoryResponse> {
  const created = await storiesApi.createStory(toCreateStoryRequest(input));
  const finished = await pollStoryUntilTerminal(created);
  return fromBackendStory(finished, input);
}

/** ---- Legacy edge-function implementation, preserved for rollback (inactive) ---- */

async function shouldRetryComposeError(err: unknown): Promise<boolean> {
  const ctx = (err as { context?: Response })?.context;
  if (!(ctx instanceof Response)) return false;
  if (ctx.status !== 502) return false;
  try {
    const body = await ctx.clone().json();
    const code = typeof body?.error === "string" ? body.error : "";
    return code === "ai_invalid_json" || code.includes("invalid_json") || code === "";
  } catch {
    return true; // 502 with non-JSON body — still worth retrying
  }
}

/** @deprecated Rollback path only — edge function `compose-story` (mode: plan). */
export async function planSelStoryViaEdgeFunction(input: ComposeStoryInput): Promise<SelPlanResponse> {
  const { data, error } = await supabase.functions.invoke("compose-story", {
    body: { ...input, mode: "plan" },
  });
  if (error) throw error;
  assertComposeOk(data);
  return data as SelPlanResponse;
}

/** @deprecated Rollback path only — edge function `compose-story` (mode: full). */
export async function composeSelStoryViaEdgeFunction(input: ComposeStoryInput): Promise<SelStoryResponse> {
  const MAX_ATTEMPTS = 3;
  const BACKOFF_MS = [800, 1800];
  let lastError: unknown = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const { data, error } = await supabase.functions.invoke("compose-story", {
      body: { ...input, mode: "full" },
    });
    if (!error) {
      assertComposeOk(data);
      return data as SelStoryResponse;
    }
    lastError = error;
    const retry = await shouldRetryComposeError(error);
    if (!retry || attempt === MAX_ATTEMPTS - 1) break;
    console.warn(`[composeSelStory] retry ${attempt + 1}/${MAX_ATTEMPTS - 1} after invalid AI JSON / 502`);
    await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt] ?? 2000));
  }
  throw lastError;
}



/** Best-effort extraction of structured details from a compose-story error response. */
export async function readComposeErrorDetails(err: unknown): Promise<{
  status?: number;
  body?: Record<string, unknown> | string | null;
  requestId?: string;
}> {
  if (err instanceof ComposeStoryError) {
    return { status: 200, body: { code: err.code, message: err.friendlyMessage } };
  }
  const ctx = (err as { context?: Response })?.context;
  if (!(ctx instanceof Response)) {
    return { status: (err as { status?: number })?.status };
  }
  let body: Record<string, unknown> | string | null = null;
  try {
    body = await ctx.clone().json();
  } catch {
    try { body = await ctx.clone().text(); } catch { body = null; }
  }
  const requestId = body && typeof body === "object" && typeof (body as { requestId?: unknown }).requestId === "string"
    ? (body as { requestId: string }).requestId
    : undefined;
  return { status: ctx.status, body, requestId };
}

export interface IllustrateInput {
  storyId: string;
  pages: { index: number; illustrationPrompt: string; emotionTag: string }[];
  characterVisualHash: string;
  characterProfile?: Record<string, unknown> | null;
  style?: string;
  /**
   * Optional client-generated idempotency key. The frontend dedups in-flight
   * jobs locally; this key lets the server (when it supports it) collapse
   * duplicate POSTs from retries or accidental double-clicks into one job.
   */
  idempotencyKey?: string;
}

export interface IllustrateResponse {
  storyId: string;
  illustrations: { index: number; imageUrl: string | null; status: string; error?: string }[];
}

export class SubscriptionRequiredError extends Error {
  feature: string;
  constructor(feature: string) {
    super(`subscription_required:${feature}`);
    this.name = "SubscriptionRequiredError";
    this.feature = feature;
  }
}

export async function illustrateSelStory(
  input: IllustrateInput,
  meta: { trigger?: "user" | "auto"; source?: string } = {},
): Promise<IllustrateResponse> {
  const trigger = meta.trigger ?? "auto";
  const source = meta.source ?? "unknown";
  if (trigger === "user") {
    console.info("[illustrate-story] user-triggered invoke", { source, pages: input.pages?.length });
  } else {
    // Image generation must be user-initiated only (Function B contract).
    console.error("[illustrate-story] BLOCKED auto/unattributed invoke", { source, stack: new Error().stack });
    throw new Error("illustrate-story must be user-triggered (pass { trigger: 'user' })");
  }

  const { data, error } = await supabase.functions.invoke("illustrate-story", {
    body: { ...input, trigger: "user", triggerSource: source },
  });
  if (error) throw error;
  if ((data as { blocked?: boolean })?.blocked) {
    throw new SubscriptionRequiredError((data as { feature?: string }).feature ?? "illustrations");
  }
  return data as IllustrateResponse;
}


export async function exportStoryPdf(storyId: string, opts: { force?: boolean } = {}): Promise<string> {
  const { data, error } = await supabase.functions.invoke("export-story-pdf", {
    body: { storyId, force: opts.force === true },
  });
  if (error) throw error;
  const body = data as {
    blocked?: boolean;
    feature?: string;
    success?: boolean;
    error?: string;
    message?: string;
    pdfUrl?: string;
    download_url?: string;
  };
  if (body?.blocked) {
    throw new SubscriptionRequiredError(body.feature ?? "pdf");
  }
  if (body?.success === false) {
    throw new Error(body.message || body.error || "pdf_export_failed");
  }
  const url = body?.download_url ?? body?.pdfUrl;
  if (!url) throw new Error("no_pdf_url");
  return url;
}


