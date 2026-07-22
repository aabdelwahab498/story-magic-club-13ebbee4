// ============================================================================
// n8n Story Generator client — calls the `n8n-story-generate` edge function.
// If the response has `fallback: true` the caller should run the local
// `compose-story` pipeline instead.
// ============================================================================

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

export async function generateStoryViaN8n(_input: N8nStoryInput): Promise<N8nStoryResult> {
  return { fallback: true, reason: "n8n_not_migrated", message: "n8n automation is not yet migrated to Backend Core" };
}
