// Phase 3/4 — client wrappers for SEL story orchestration + illustration.
import { axiosInstance } from "@/api/client";

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


export async function planSelStory(input: ComposeStoryInput): Promise<SelPlanResponse> {
  try {
    const response = await axiosInstance.post("/stories/plan", {
      childId: input.childProfileId,
      theme: input.theme,
      selGoal: input.emotionalFocus?.join(", ") || "Empathy",
      language: input.language || "en",
    });

    const plan = response.data;
    
    // Map backend StoryPlan format to old frontend blueprint layout
    return {
      requestId: "plan_request",
      mode: "plan",
      blueprint: {
        title: plan.title,
        hero: {
          name: plan.characters?.[0]?.name || "Hero",
          sense: plan.characters?.[0]?.description || "Sense",
          problem: plan.conflict || "Problem",
          engine: "Engine",
          charm: "Charm",
        },
        mentor: plan.characters?.find((c: any) => c.role?.toLowerCase() === "mentor") || plan.characters?.[1] || { name: "Mentor", role: "Mentor" },
        companion: plan.characters?.find((c: any) => c.role?.toLowerCase() === "companion") || plan.characters?.[2] || { name: "Companion", role: "Companion" },
        acts: {
          act1_normalWorld: `Introduction of ${plan.characters?.[0]?.name || "the hero"}.`,
          act2_disturbance: plan.conflict,
          act3_attempts: [plan.resolution],
          act4_resolution: `Resolution of the conflict: ${plan.resolution}`,
        },
        selOutcome: {
          skill: plan.selGoals?.[0] || "Empathy",
          emotion: "Connected",
          statement: `We learned about ${plan.selGoals?.join(", ") || "social emotional learning"}.`,
        },
      },
      age_band: input.age <= 5 ? "3-5" : input.age <= 8 ? "6-8" : "9-12",
    } as SelPlanResponse;
  } catch (err: any) {
    const message = err.response?.data?.message || err.message || "Failed to plan story";
    throw new ComposeStoryError("plan_failed", message);
  }
}



// composeSelStory has been migrated to useCreateStory hook

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

  try {
    // 1. Trigger the job on NestJS Backend Core
    await axiosInstance.post(`/media/stories/${input.storyId}/illustrations`);
    
    // 2. Poll until completed or failed
    const maxAttempts = 60; // 60 seconds timeout
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const res = await axiosInstance.get<any>(`/media/stories/${input.storyId}/illustrations`);
      const job = res.data;
      
      if (job.jobStatus === "COMPLETED" || job.jobStatus === "FAILED" || job.completedPages + job.failedPages >= job.totalPages) {
        return {
          storyId: input.storyId,
          illustrations: (job.illustrations || []).map((i: any) => ({
            index: i.pageNumber,
            imageUrl: i.imageUrl,
            status: i.status,
          })),
        };
      }
    }
    throw new Error("Illustration generation timed out");
  } catch (err: any) {
    if (err.response?.status === 403 || err.response?.data?.message?.includes("limit")) {
      throw new SubscriptionRequiredError("illustrations");
    }
    throw err;
  }
}


export async function exportStoryPdf(storyId: string, _opts: { force?: boolean } = {}): Promise<string> {
  try {
    const response = await axiosInstance.post<{ download_url?: string }>(`/media/stories/${storyId}/export/pdf`);
    const url = response.data.download_url;
    if (!url) throw new Error("no_pdf_url");
    return url;
  } catch (err: any) {
    if (err.response?.status === 403 || err.response?.data?.message?.includes("limit")) {
      throw new SubscriptionRequiredError("pdf");
    }
    throw err;
  }
}

