// Full-story narration + video manifest client helpers.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { axiosInstance } from "@/api/client";

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
      await axiosInstance.post<{ mediaId: string; status: string }>(`/media/stories/${args.storyId}/audio`);
      
      const maxAttempts = 60;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const res = await axiosInstance.get<any>(`/media/stories/${args.storyId}/audio`);
        const job = res.data;
        if (job.status === "COMPLETED") {
          return {
            audio_url: job.audioUrl,
            pages: 0,
            page_weights: [],
            bytes: 0,
          } as FullNarrationResult;
        }
        if (job.status === "FAILED") {
          throw new Error("Narration generation failed");
        }
      }
      throw new Error("Narration generation timed out");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ai-story-history"] });
      toast.success("Narration ready 🎧");
    },
    onError: (e: Error) => {
      toast.error(e.message || "Narration failed");
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
  return useMutation({
    mutationFn: async (_args: {
      storyId: string;
      language?: string;
      character?: string;
    }): Promise<ClassicNarrationResult> => {
      throw new Error("Classic story narration is not yet migrated to Backend Core");
    },
    onError: (e: Error) => {
      toast.error(e.message || "Narration failed");
    },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// Edge TTS (free MP3 download, no API key). Uses Microsoft Edge Read Aloud
// via the `narrate-story-edge` function. Always returns HTTP 200 with a
// structured `{ success, code?, message?, url? }` body.
// ─────────────────────────────────────────────────────────────────────────────

export type StoryMp3Status = "success" | "cached" | "fallback";

/** Coarse-grained phase the caller can render in the UI. */
export type TtsProgressPhase =
  | "queued"       // request queued, waiting for server
  | "generating"   // primary provider synthesizing
  | "retrying"     // primary failed, fallback provider being tried
  | "finalizing"   // audio uploaded, URL being returned
  | "ready"        // audio available
  | "cached";      // served from cache (no synthesis)

export interface TtsProgressEvent {
  phase: TtsProgressPhase;
  /** Human-readable label (already localized-neutral). */
  message: string;
  /** Attempt index for the retry phase, if applicable. */
  attempt?: number;
}

export interface StoryMp3Result {
  url: string;
  voice: string;
  provider: string;
  providersAttempted: string[];
  status: StoryMp3Status;
  cached: boolean;
  bytes?: number;
  duration?: number;
  chunkCount?: number;
  cacheKey?: string;
}

export class StoryMp3Error extends Error {
  code: string;
  retryable: boolean;
  provider?: string;
  constructor(code: string, message: string, opts?: { retryable?: boolean; provider?: string }) {
    super(message);
    this.code = code;
    this.name = "StoryMp3Error";
    this.retryable = opts?.retryable ?? true;
    this.provider = opts?.provider;
  }
}

export interface GenerateStoryMp3Options {
  onProgress?: (evt: TtsProgressEvent) => void;
  signal?: AbortSignal;
}

export async function generateStoryMp3(
  args: {
    text: string;
    language: string;
    voice?: string;
    storyId?: string;
  },
  options: GenerateStoryMp3Options = {},
): Promise<StoryMp3Result> {
  const emit = (evt: TtsProgressEvent) => {
    try { options.onProgress?.(evt); } catch { /* consumer errors must not break TTS */ }
  };
  emit({ phase: "queued", message: "Queued for narration…" });
  
  const genTimer = setTimeout(
    () => emit({ phase: "generating", message: "Generating narration audio…" }),
    250,
  );

  try {
    const response = await axiosInstance.post<{ audioContent: string }>('/media/tts', {
      text: args.text,
      language: args.language,
      character: args.voice,
    });
    clearTimeout(genTimer);

    if (!response.data || !response.data.audioContent) {
      throw new Error("No audio content returned from TTS service");
    }

    emit({ phase: "finalizing", message: "Preparing download…" });
    const audioUrl = `data:audio/mpeg;base64,${response.data.audioContent}`;
    
    const result: StoryMp3Result = {
      url: audioUrl,
      voice: args.voice || "default",
      provider: "google",
      providersAttempted: ["google"],
      status: "success",
      cached: false,
      bytes: response.data.audioContent.length,
      duration: 0,
      chunkCount: 1,
      cacheKey: "tts_" + Date.now(),
    };
    emit({ phase: "ready", message: "Audio ready." });
    return result;
  } catch (err: any) {
    clearTimeout(genTimer);
    throw new StoryMp3Error(
      "network_error",
      err.response?.data?.message || err.message || "Could not reach the audio service. Please try again.",
    );
  }
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


