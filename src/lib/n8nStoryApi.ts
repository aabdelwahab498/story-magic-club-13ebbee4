// ============================================================================
// n8n Story Generator client — calls the `n8n-story-generate` edge function.
// If the response has `fallback: true` the caller should run the local
// `compose-story` pipeline instead.
// ============================================================================
import { supabase } from "@/integrations/supabase/client";

export interface N8nStoryPage {
  index: number;
  text: string;
  illustrationPrompt: string;
  emotionTag: string;
}

export interface N8nStoryPayload {
  title: string;
  language: string;
  pages: N8nStoryPage[];
  provider: string;
}

export interface N8nStoryResult {
  fallback: boolean;
  reason?: string;
  http_status?: number | null;
  message?: string;
  elapsed_ms?: number;
  provider?: string;
  story?: N8nStoryPayload;
}

export interface N8nStoryInput {
  idea: string;
  childId?: string | null;
  childName?: string | null;
  language?: string;
  ageGroup?: string;
  userId?: string | null;
}

export async function generateStoryViaN8n(input: N8nStoryInput): Promise<N8nStoryResult> {
  const { data, error } = await supabase.functions.invoke<N8nStoryResult>(
    "n8n-story-generate",
    {
      body: {
        idea: input.idea,
        child_id: input.childId ?? null,
        child_name: input.childName ?? null,
        language: input.language ?? "en",
        age_group: input.ageGroup ?? null,
        user_id: input.userId ?? null,
      },
    },
  );
  if (error) {
    return { fallback: true, reason: "invoke_error", message: error.message };
  }
  return data ?? { fallback: true, reason: "empty_response" };
}
