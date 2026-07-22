import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Save, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface Settings {
  id: string;
  cinematic_fields_enabled: Record<string, boolean>;
  system_prompt_override: string | null;
  user_prompt_addendum: string | null;
  model: string;
  temperature: number;
  quality_threshold: number;
  max_regenerations: number;
  default_visual_style: string;
  banned_words: string[];
}

const FIELD_KEYS: { key: string; labelKey: string; labelDefault: string }[] = [
  { key: "voiceOver", labelKey: "admin_story_engine.fields.voice_over", labelDefault: "🎙️ Voice-Over" },
  { key: "dialogue", labelKey: "admin_story_engine.fields.dialogue", labelDefault: "💬 Dialogue" },
  { key: "soundEffects", labelKey: "admin_story_engine.fields.sound_effects", labelDefault: "🔊 Sound Effects" },
  { key: "backgroundMusic", labelKey: "admin_story_engine.fields.background_music", labelDefault: "🎵 Background Music" },
  { key: "visualPrompt", labelKey: "admin_story_engine.fields.visual_prompt", labelDefault: "🖼️ Visual Prompt" },
  { key: "animationPrompt", labelKey: "admin_story_engine.fields.animation_prompt", labelDefault: "🎬 Animation Prompt" },
  { key: "imagePrompt", labelKey: "admin_story_engine.fields.image_prompt", labelDefault: "🪄 Image Prompt" },
  { key: "videoPrompt", labelKey: "admin_story_engine.fields.video_prompt", labelDefault: "📹 Video Prompt" },
];

const MODELS = [
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "google/gemini-2.5-pro",
  "google/gemini-3-flash-preview",
  "openai/gpt-5-mini",
  "openai/gpt-5",
];

const VISUAL_STYLES = ["Pixar/Ghibli", "Pixar", "Studio Ghibli", "Disney", "Anime", "Watercolor Storybook", "Claymation"];

export default function AdminStoryEnginePage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [s, setS] = useState<Settings | null>(null);
  const [bannedText, setBannedText] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("story_generation_settings")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) {
        toast.error(error.message);
      } else if (data) {
        setS(data as unknown as Settings);
        setBannedText((data.banned_words as string[] | null)?.join(", ") ?? "");
      }
      setLoading(false);
    })();
  }, []);

  if (loading || !s) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const setField = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });
  const toggleCinematic = (key: string, on: boolean) =>
    setS({ ...s, cinematic_fields_enabled: { ...s.cinematic_fields_enabled, [key]: on } });

  const save = async () => {
    setSaving(true);
    const banned = bannedText.split(",").map((w) => w.trim()).filter(Boolean);
    const { error } = await supabase
      .from("story_generation_settings")
      .update({
        cinematic_fields_enabled: s.cinematic_fields_enabled,
        system_prompt_override: s.system_prompt_override?.trim() || null,
        user_prompt_addendum: s.user_prompt_addendum?.trim() || null,
        model: s.model,
        temperature: s.temperature,
        quality_threshold: s.quality_threshold,
        max_regenerations: s.max_regenerations,
        default_visual_style: s.default_visual_style,
        banned_words: banned,
      })
      .eq("id", s.id);
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success(t("admin_story_engine.saved", "Saved ✨"));
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Wand2 className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">
            {t("admin_story_engine.cinematic_story_engine", "Cinematic Story Engine")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("admin_story_engine.full_control_over_the_ai_writer_model_pr", "Full control over the AI writer: model, prompt, quality and cinematic fields.")}
          </p>
        </div>
      </div>

      {/* Cinematic Fields */}
      <Card>
        <CardHeader>
          <CardTitle>{t("admin_story_engine.per_page_cinematic_fields", "Per-page cinematic fields")}</CardTitle>
          <CardDescription>
            {t("admin_story_engine.choose_which_fields_the_ai_generates_for", "Choose which fields the AI generates for each page.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FIELD_KEYS.map((f) => (
            <div key={f.key} className="flex items-center justify-between rounded-lg border p-3">
              <Label htmlFor={f.key} className="cursor-pointer">{t(f.labelKey, f.labelDefault)}</Label>
              <Switch
                id={f.key}
                checked={s.cinematic_fields_enabled[f.key] !== false}
                onCheckedChange={(v) => toggleCinematic(f.key, v)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Model + Temperature */}
      <Card>
        <CardHeader>
          <CardTitle>{t("admin_story_engine.model_creativity", "Model & creativity")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("admin_story_engine.ai_model", "AI Model")}</Label>
            <Select value={s.model} onValueChange={(v) => setField("model", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MODELS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("admin_story_engine.temperature", "Temperature")}: {s.temperature.toFixed(2)}</Label>
            <Slider min={0} max={1.5} step={0.05} value={[s.temperature]} onValueChange={([v]) => setField("temperature", v)} />
          </div>
          <div className="space-y-2">
            <Label>{t("admin_story_engine.default_visual_style", "Default visual style")}</Label>
            <Select value={s.default_visual_style} onValueChange={(v) => setField("default_visual_style", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {VISUAL_STYLES.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Quality */}
      <Card>
        <CardHeader>
          <CardTitle>{t("admin_story_engine.quality_safety_limits", "Quality & safety limits")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("admin_story_engine.quality_pass_threshold_25", "Quality pass threshold /25")}: {s.quality_threshold}</Label>
            <Slider min={10} max={25} step={1} value={[s.quality_threshold]} onValueChange={([v]) => setField("quality_threshold", v)} />
          </div>
          <div className="space-y-2">
            <Label>{t("admin_story_engine.max_regenerations", "Max regenerations")}: {s.max_regenerations}</Label>
            <Slider min={0} max={5} step={1} value={[s.max_regenerations]} onValueChange={([v]) => setField("max_regenerations", v)} />
          </div>
          <div className="space-y-2">
            <Label>{t("admin_story_engine.banned_words_comma_separated", "Banned words (comma separated)")}</Label>
            <Input value={bannedText} onChange={(e) => setBannedText(e.target.value)} placeholder="violence, blood, scary" />
          </div>
        </CardContent>
      </Card>

      {/* Prompts */}
      <Card>
        <CardHeader>
          <CardTitle>{t("admin_story_engine.prompt_overrides", "Prompt overrides")}</CardTitle>
          <CardDescription>
            {t("admin_story_engine.leave_empty_to_use_the_default_built_in_", "Leave empty to use the default built-in prompt.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("admin_story_engine.system_prompt_full_override", "System Prompt (full override)")}</Label>
            <Textarea
              rows={6}
              value={s.system_prompt_override ?? ""}
              onChange={(e) => setField("system_prompt_override", e.target.value)}
              placeholder={t("admin_story_engine.e_g_you_are_a_magical_children_s_storyte", "e.g. You are a magical children's storyteller...")}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("admin_story_engine.extra_user_prompt_instructions", "Extra User Prompt instructions")}</Label>
            <Textarea
              rows={4}
              value={s.user_prompt_addendum ?? ""}
              onChange={(e) => setField("user_prompt_addendum", e.target.value)}
              placeholder={t("admin_story_engine.extra_instructions_appended_to_every_sto", "Extra instructions appended to every story")}
            />
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-4 flex justify-end">
        <Button onClick={save} disabled={saving} size="lg" className="shadow-lg">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          {t("admin_story_engine.save_settings", "Save settings")}
        </Button>
      </div>
    </div>
  );
}
