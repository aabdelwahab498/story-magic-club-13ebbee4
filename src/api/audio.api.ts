// src/api/audio.api.ts
// DATA SOURCE: Supabase edge functions (`narrate-story-full`, `narrate-story`)
// and the `ai_story_history.audio_url` column. The legacy NestJS `/media/*`
// endpoints are gone — never reintroduce axios here.
import { supabase } from '@/integrations/supabase/client';

export interface AudioJobResponse {
  status: 'NONE' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  audioUrl: string | null;
  error?: string | null;
}

/**
 * Generate stitched full-story narration. Runs synchronously in the edge
 * function, so the caller's mutation stays pending until the MP3 is stored.
 */
export const generateAudio = async (storyId: string): Promise<{ mediaId: string; status: string }> => {
  const { data, error } = await supabase.functions.invoke('narrate-story-full', {
    body: { storyId, character: '' },
  });
  if (error) throw new Error(error.message || 'narration_failed');
  if (data?.error) throw new Error(data.message || data.error);
  return { mediaId: storyId, status: 'COMPLETED' };
};

/** Read the persisted narration URL for a saved AI story. */
export const fetchAudio = async (storyId: string): Promise<AudioJobResponse> => {
  const { data, error } = await supabase
    .from('ai_story_history')
    .select('audio_url')
    .eq('id', storyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const audioUrl = (data as { audio_url?: string | null } | null)?.audio_url ?? null;
  return { status: audioUrl ? 'COMPLETED' : 'NONE', audioUrl };
};

export const retryAudio = generateAudio;

export const deleteAudio = async (storyId: string): Promise<{ success: boolean }> => {
  const { error } = await supabase
    .from('ai_story_history')
    .update({ audio_url: null })
    .eq('id', storyId);
  if (error) throw new Error(error.message);
  return { success: true };
};

/** One-off TTS for inline playback (classic library pages). */
export const synthesizeDynamicTts = async (args: {
  text: string;
  language: string;
  character?: string;
}): Promise<{ audioContent: string }> => {
  const { data, error } = await supabase.functions.invoke('narrate-story', {
    body: { text: args.text, language: args.language, character: args.character ?? '' },
  });
  if (error) throw new Error(error.message || 'tts_failed');
  if (data?.error) throw new Error(data.error);
  return data as { audioContent: string };
};
