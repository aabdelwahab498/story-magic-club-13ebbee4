// Full-story narration + video manifest client helpers.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface FullNarrationResult {
  audio_url: string;
  pages: number;
  page_weights: number[];
  bytes: number;
}

/**
 * Trigger full multi-page narration for a saved AI story.
 * Stitches all pages into one MP3, stores in story-audio bucket and writes
 * `audio_url` on ai_story_history. Returns the audio URL + per-page weights.
 */
export const useGenerateFullNarration = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { storyId: string; character?: string }): Promise<FullNarrationResult> => {
      const { data, error } = await supabase.functions.invoke("narrate-story-full", {
        body: { storyId: args.storyId, character: args.character ?? "" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as FullNarrationResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-story-history"] });
      toast.success("Narration ready 🎧");
    },
    onError: (e: Error) => {
      const msg = e.message || "Narration failed";
      if (msg.includes("subscription_required")) {
        toast.error("HD narration needs a paid plan.");
      } else {
        toast.error(msg);
      }
    },
  });
};

export interface ClassicNarrationResult {
  audio_url: string;
  language: string;
  pages: { text: string; image_url: string | null }[];
  page_weights: number[];
  bytes: number;
}

/**
 * Admin/editor: generate stitched narration for a CLASSIC published story.
 * Persists `stories.audio_url` so every reader sees the play button.
 */
export const useGenerateClassicNarration = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      storyId: string;
      language?: string;
      character?: string;
    }): Promise<ClassicNarrationResult> => {
      const { data, error } = await supabase.functions.invoke("narrate-classic-story", {
        body: {
          storyId: args.storyId,
          language: args.language ?? "en",
          character: args.character ?? "",
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as ClassicNarrationResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["story"] });
      qc.invalidateQueries({ queryKey: ["stories"] });
      toast.success("Narration ready 🎧");
    },
    onError: (e: Error) => toast.error(e.message || "Narration failed"),
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Edge TTS (free MP3 download, no API key). Uses Microsoft Edge Read Aloud
// via the `narrate-story-edge` function. Always returns HTTP 200 with a
// structured `{ success, code?, message?, url? }` body.
// ─────────────────────────────────────────────────────────────────────────────

export interface StoryMp3Result {
  url: string;
  voice: string;
  cached: boolean;
  bytes?: number;
}

export class StoryMp3Error extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "StoryMp3Error";
  }
}

export async function generateStoryMp3(args: {
  text: string;
  language: string;
  voice?: string;
  storyId?: string;
}): Promise<StoryMp3Result> {
  const { data, error } = await supabase.functions.invoke("narrate-story-edge", {
    body: args,
  });
  if (error) {
    throw new StoryMp3Error(
      "network_error",
      "Could not reach the audio service. Please try again.",
    );
  }
  if (!data || data.success !== true) {
    throw new StoryMp3Error(
      data?.code || "unknown",
      data?.message || "Audio generation failed. Please try again.",
    );
  }
  return {
    url: data.url as string,
    voice: data.voice as string,
    cached: !!data.cached,
    bytes: data.bytes,
  };
}

export async function downloadStoryMp3(url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) throw new StoryMp3Error("download_failed", "Could not download the audio file.");
  const blob = await res.blob();
  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objUrl;
  a.download = filename;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(objUrl), 4000);
}


