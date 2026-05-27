import { useEffect, useRef, useState } from "react";
import { Music, MusicIcon, Loader2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  theme?: string;
  mood?: string;
  /** Whether the story narration is currently playing. Music auto-plays/pauses with it. */
  active: boolean;
}

export default function StoryBackgroundMusic({ theme = "friendship", mood = "calm", active }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [volume, setVolume] = useState(0.2);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Sync play/pause with `active`
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !audioUrl || !enabled) return;
    if (active) {
      el.volume = volume;
      el.play().catch(() => undefined);
    } else {
      el.pause();
    }
  }, [active, audioUrl, enabled, volume]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const handleEnable = async () => {
    if (enabled) {
      setEnabled(false);
      audioRef.current?.pause();
      return;
    }
    if (audioUrl) {
      setEnabled(true);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-story-music", {
        body: { theme, mood, durationSeconds: 60 },
      });
      if (error) throw error;
      if (data?.fallback || !data?.audioUrl) {
        toast.info(
          data?.error === "subscription_required"
            ? "موسيقى الخلفية متاحة في الباقة المدفوعة"
            : "تعذّر توليد الموسيقى الآن",
        );
        return;
      }
      setAudioUrl(data.audioUrl as string);
      setEnabled(true);
    } catch (e) {
      console.error(e);
      toast.error("فشل تحميل الموسيقى");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-xl bg-card/60 px-3 py-2 backdrop-blur">
      <Button
        type="button"
        size="sm"
        variant={enabled ? "default" : "outline"}
        onClick={handleEnable}
        disabled={loading}
        className="gap-2"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : enabled ? (
          <MusicIcon className="h-4 w-4" />
        ) : (
          <Music className="h-4 w-4" />
        )}
        <span className="text-xs">
          {enabled ? "موسيقى مشغّلة" : "موسيقى خلفية AI"}
        </span>
      </Button>
      {enabled && (
        <div className="flex w-36 items-center gap-2">
          <VolumeX className="h-3 w-3 text-muted-foreground" />
          <Slider
            value={[volume * 100]}
            min={0}
            max={50}
            step={5}
            onValueChange={(v) => setVolume((v[0] ?? 20) / 100)}
            aria-label="Music volume"
          />
        </div>
      )}
      {audioUrl && <audio ref={audioRef} src={audioUrl} loop preload="auto" />}
    </div>
  );
}
