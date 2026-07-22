// Phase 1 — DB-backed AI story history.
import { useQuery } from "@tanstack/react-query";
import { storiesApi } from "@/api/stories.api";

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
  status?: string;
}

export interface SaveStoryInput {
  prompt_data: Record<string, unknown>;
  story_text: string;
  language: string;
  title?: string;
  child_profile_id?: string | null;
}

/** Saves a generated AI story for the currently authenticated user (no-op if signed out). */
export async function saveAiStory(_input: SaveStoryInput): Promise<string | null> {
  // In the new backend architecture, stories are automatically saved when they are generated.
  // We can just return a dummy ID or null since the caller doesn't strictly depend on it.
  return "migrated_to_backend";
}

export const useMyAiStories = (enabled = true, limit = 50) =>
  useQuery({
    queryKey: ["my_ai_stories", limit],
    enabled,
    queryFn: async (): Promise<AiStoryRow[]> => {
      const data = await storiesApi.getUserStories();
      return data.slice(0, limit).map((dto) => ({
        id: dto.id,
        user_id: "", // Not needed for UI
        prompt_data: dto.preferences || {},
        generated_story: {},
        pages: [],
        language: dto.language,
        title: dto.theme,
        audio_url: null,
        video_embed_url: null,
        created_at: dto.createdAt,
        status: dto.status,
      })) as AiStoryRow[];
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
      const to = from + pageSize;
      const data = await storiesApi.getUserStories();
      
      const mappedRows = data.map((dto) => ({
        id: dto.id,
        user_id: "", 
        prompt_data: dto.preferences || {},
        generated_story: {},
        pages: [],
        language: dto.language,
        title: dto.theme,
        audio_url: null,
        video_embed_url: null,
        created_at: dto.createdAt,
        status: dto.status,
      })) as AiStoryRow[];

      const rows = mappedRows.slice(from, to);
      const total = mappedRows.length;
      return { rows, total, hasMore: to < total };
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
  _input: {
    scenes: string[];
    character?: string;
    storyId?: string;
  },
  _meta: { trigger?: "user" | "auto"; source?: string } = {},
): Promise<ClassicIllustrationsResponse> {
  throw new Error("Classic story illustration is not yet migrated to Backend Core");
}
