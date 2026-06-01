// Phase 1 — DB-backed AI story history.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AiStoryRow {
  id: string;
  user_id: string;
  prompt_data: Record<string, unknown>;
  generated_story: Record<string, unknown> | { text?: string };
  pages: Array<{ text?: string; content?: string; image_url?: string | null }>;
  language: string;
  title: string | null;
  audio_url: string | null;
  video_embed_url: string | null;
  created_at: string;
}

export interface SaveStoryInput {
  prompt_data: Record<string, unknown>;
  story_text: string;
  language: string;
  title?: string;
  child_profile_id?: string | null;
}

/** Saves a generated AI story for the currently authenticated user (no-op if signed out). */
export async function saveAiStory(input: SaveStoryInput): Promise<string | null> {
  const { data: sess } = await supabase.auth.getUser();
  const uid = sess.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from("ai_story_history")
    .insert([
      {
        user_id: uid,
        child_profile_id: input.child_profile_id ?? null,
        prompt_data: input.prompt_data as never,
        generated_story: { text: input.story_text } as never,
        language: input.language,
        title: input.title ?? null,
      },
    ])
    .select("id")
    .single();
  if (error) {
    console.error("saveAiStory error", error);
    return null;
  }
  return data?.id ?? null;
}

export const useMyAiStories = (enabled = true, limit = 50) =>
  useQuery({
    queryKey: ["my_ai_stories", limit],
    enabled,
    queryFn: async (): Promise<AiStoryRow[]> => {
      const { data, error } = await supabase
        .from("ai_story_history")
        .select("*")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as AiStoryRow[];
    },
  });

/** Paginated fetch — returns one page of rows (rows + hasMore + total). */
export interface AiStoriesPage {
  rows: AiStoryRow[];
  total: number;
  hasMore: boolean;
}

export const useMyAiStoriesPage = (page: number, pageSize: number, enabled = true) =>
  useQuery({
    queryKey: ["my_ai_stories_page", page, pageSize],
    enabled,
    queryFn: async (): Promise<AiStoriesPage> => {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      const { data, error, count } = await supabase
        .from("ai_story_history")
        .select("*", { count: "exact" })
        // Deterministic order so pagination never skips/duplicates rows that
        // share the same created_at timestamp.
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to);
      if (error) throw error;
      const rows = (data ?? []) as AiStoryRow[];
      const total = count ?? 0;
      return { rows, total, hasMore: from + rows.length < total };
    },
  });

export interface ClassicIllustration {
  index: number;
  imageUrl: string | null;
  status: string;
}

export interface ClassicIllustrationsResponse {
  illustrations: ClassicIllustration[];
  gated: boolean;
  tier: "guest" | "free" | "paid";
}

/** Generates illustrations for the classic AI Storyteller flow.
 *  Cover image is free for everyone; additional scenes require a paid plan. */
export async function generateClassicIllustrations(
  input: {
    scenes: string[];
    character?: string;
    theme?: string;
    ageId?: string;
    language?: string;
  },
  meta: { trigger?: "user" | "auto"; source?: string } = {},
): Promise<ClassicIllustrationsResponse> {
  const trigger = meta.trigger ?? "auto";
  const source = meta.source ?? "unknown";
  if (trigger === "user") {
    console.info("[generate-classic-illustrations] user-triggered invoke", { source, scenes: input.scenes.length });
  } else {
    console.error("[generate-classic-illustrations] BLOCKED auto/unattributed invoke", { source, stack: new Error().stack });
    throw new Error("generate-classic-illustrations must be user-triggered (pass { trigger: 'user' })");
  }
  const { data, error } = await supabase.functions.invoke(
    "generate-classic-illustrations",
    { body: { ...input, trigger: "user", triggerSource: source } },
  );
  if (error) throw error;
  return data as ClassicIllustrationsResponse;
}

