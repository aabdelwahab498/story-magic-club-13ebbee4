import { useEffect, useState } from "react";
import { Settings2, AlertTriangle } from "lucide-react";
import {
  isBrowserTtsSupported,
  listBrowserVoices,
  getNarratorRate,
  setNarratorRate,
  getNarratorVoiceURI,
  setNarratorVoiceURI,
} from "@/lib/browserTts";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { useTranslation } from "react-i18next";

interface Props {
  /** Story language, e.g. "en" or "ar". Filters voice options. */
  language: string;
  /** Called when preferences change so caller can restart playback if needed. */
  onChange?: () => void;
}

/**
 * Narrator settings — speed + installed system voice.
 * Uses the browser's Web Speech API only. No API keys, no payments.
 */
export function BrowserNarratorSettings({ language, onChange }: Props) {
  const { t } = useTranslation();
  const supported = isBrowserTtsSupported();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [rate, setRate] = useState<number>(() => (supported ? getNarratorRate() : 1));
  const [voiceURI, setVoiceURI] = useState<string>(() => (supported ? getNarratorVoiceURI() : ""));

  useEffect(() => {
    if (!supported) return;
    const prefix = (language || "en").slice(0, 2).toLowerCase();
    listBrowserVoices(prefix).then((list) => {
      // Fall back to all voices if none match the story language.
      if (list.length) return setVoices(list);
      listBrowserVoices().then(setVoices);
    });
  }, [language, supported]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="p-2 rounded-full bg-white/30 dark:bg-white/20 backdrop-blur-sm border border-white/40 dark:border-white/30 text-glass dark:text-white hover:bg-white/40 dark:hover:bg-white/30 transition-colors"
          title={t("narrator.settings", "Narrator settings")}
          aria-label={t("narrator.settings", "Narrator settings")}
        >
          <Settings2 className="h-5 w-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-4" align="end">
        {!supported ? (
          <div className="flex items-start gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
            <p className="text-muted-foreground">
              {t(
                "narrator.unsupported",
                "Your browser doesn't support built-in narration. Please try the latest Chrome, Edge, Safari, or Firefox.",
              )}
            </p>
          </div>
        ) : (
          <>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold">
                  {t("narrator.speed", "Speed")}
                </label>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {rate.toFixed(2)}×
                </span>
              </div>
              <Slider
                min={0.5}
                max={2}
                step={0.05}
                value={[rate]}
                onValueChange={(v) => {
                  const next = v[0] ?? 1;
                  setRate(next);
                  setNarratorRate(next);
                  onChange?.();
                }}
              />
              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                <span>0.5×</span><span>1×</span><span>2×</span>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold block mb-2">
                {t("narrator.voice", "Voice")}
              </label>
              {voices.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t("narrator.no_voices", "No voices available for this language — using default.")}
                </p>
              ) : (
                <select
                  value={voiceURI}
                  onChange={(e) => {
                    setVoiceURI(e.target.value);
                    setNarratorVoiceURI(e.target.value);
                    onChange?.();
                  }}
                  className="w-full text-sm rounded-md border border-input bg-background px-2 py-1.5"
                >
                  <option value="">{t("narrator.auto_voice", "Automatic (best match)")}</option>
                  {voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} — {v.lang}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
