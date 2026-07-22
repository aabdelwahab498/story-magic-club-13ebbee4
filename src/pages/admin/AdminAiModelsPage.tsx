import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Sparkles,
  Image as ImageIcon,
  KeyRound,
  Cloud,
  Zap,
  Clock,
  Loader2,
  Save,
  PlayCircle,
  ArrowRight,
} from "lucide-react";

// ──────────────────────────────────────────────────────────────────────
// Static catalog (mirrors supabase/functions/_shared/sel/gateway.ts)
// UI-level only: editing here does NOT change backend behavior.
// ──────────────────────────────────────────────────────────────────────

type Tier = "user" | "gateway" | "openrouter_free";

interface TextModel {
  id: string;
  provider: string;
  tier: Tier;
  notes?: string;
}

interface ImageModel {
  id: string;
  provider: string;
  notes?: string;
  suggestedPrompts: string[];
}

const PRIORITY: { tier: Tier; titleKey: string; titleFallback: string; descKey: string; descFallback: string; icon: typeof KeyRound; color: string }[] = [
  {
    tier: "user",
    titleKey: "admin_ai.priority.user.title",
    titleFallback: "1. User-Supplied API Keys",
    descKey: "admin_ai.priority.user.desc",
    descFallback: "Highest priority. If a signed-in user has saved their own API keys (OpenAI, Google, OpenRouter, Anthropic, Custom), generation runs on their account.",
    icon: KeyRound,
    color: "from-emerald-500 to-teal-500",
  },
  {
    tier: "gateway",
    titleKey: "admin_ai.priority.gateway.title",
    titleFallback: "2. Lovable AI Gateway",
    descKey: "admin_ai.priority.gateway.desc",
    descFallback: "Default fallback using LOVABLE_API_KEY. Free included usage on Gemini models — preferred when no user key is present.",
    icon: Cloud,
    color: "from-violet-500 to-fuchsia-500",
  },
  {
    tier: "openrouter_free",
    titleKey: "admin_ai.priority.openrouter.title",
    titleFallback: "3. OpenRouter Free Models",
    descKey: "admin_ai.priority.openrouter.desc",
    descFallback: "Final fallback using OPENROUTER_API_KEY. Free-tier models are used only if Lovable Gateway is unavailable or returns 5xx.",
    icon: Zap,
    color: "from-amber-500 to-orange-500",
  },
];

const TEXT_MODELS: TextModel[] = [
  // User keys
  { id: "openai/gpt-4o-mini", provider: "OpenAI (user key)", tier: "user" },
  { id: "google/gemini-2.5-flash", provider: "Google (user key)", tier: "user" },
  { id: "openrouter/openai/gpt-4o-mini", provider: "OpenRouter (user key)", tier: "user" },
  { id: "anthropic/claude-3-5-sonnet-latest", provider: "Anthropic (user key)", tier: "user" },
  { id: "custom/openai-compatible", provider: "Custom OpenAI-compatible (user key)", tier: "user" },
  // Lovable Gateway
  { id: "google/gemini-3-flash-preview", provider: "Lovable AI Gateway", tier: "gateway", notes: "Default" },
  { id: "google/gemini-2.5-flash", provider: "Lovable AI Gateway", tier: "gateway" },
  { id: "google/gemini-2.5-flash-lite", provider: "Lovable AI Gateway", tier: "gateway" },
  // OpenRouter free
  { id: "openai/gpt-oss-120b:free", provider: "OpenRouter Free", tier: "openrouter_free" },
  { id: "z-ai/glm-4.5-air:free", provider: "OpenRouter Free", tier: "openrouter_free" },
  { id: "meta-llama/llama-3.3-70b-instruct:free", provider: "OpenRouter Free", tier: "openrouter_free" },
];

const IMAGE_MODELS: ImageModel[] = [
  {
    id: "google/gemini-2.5-flash-image",
    provider: "Google (Nano Banana)",
    notes: "Fast, kid-friendly illustrations. Used by illustrate-story.",
    suggestedPrompts: [
      "A whimsical watercolor illustration of a small fox astronaut exploring a starry meadow at night.",
      "Soft pastel storybook scene: a curious child looking through a window at a glowing magical forest.",
      "A cozy bedroom at twilight with a tiny dragon reading a book to a sleeping child.",
    ],
  },
  {
    id: "google/gemini-3-pro-image-preview",
    provider: "Google (Pro Preview)",
    notes: "Higher fidelity. Use for hero / cover illustrations.",
    suggestedPrompts: [
      "Highly detailed children's book cover: brave girl with a lantern leading friendly creatures through a moonlit forest.",
      "Vibrant illustration of an underwater kingdom with a young mermaid and her dolphin best friend.",
    ],
  },
  {
    id: "google/gemini-3.1-flash-image-preview",
    provider: "Google (Nano Banana 2)",
    notes: "Fast iteration with pro-level quality.",
    suggestedPrompts: [
      "Storybook illustration: a tiny inventor child building a flying machine out of cardboard and stars.",
      "Warm, painterly scene of two siblings planting a magical seed in a sunlit garden.",
    ],
  },
];

// localStorage keys
const LS_TEXT = "admin_ai_pref_text_model";
const LS_IMAGE = "admin_ai_pref_image_model";

// ──────────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────────

export default function AdminAiModelsPage() {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 max-w-6xl">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <h1 className="text-2xl md:text-3xl font-bold">
            {t("admin_ai.title", "AI Generator — Models & Test")}
          </h1>
        </div>
        <p className="text-muted-foreground">
          {t(
            "admin_ai.subtitle",
            "View the model catalog, priority chain, image generation options, and run a quick prompt to see which model responds and how fast.",
          )}
        </p>
        <div className="rounded-lg border border-dashed border-amber-400/60 bg-amber-50/40 dark:bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
          {t(
            "admin_ai.ui_only_notice",
            "UI-level page: preferences saved here apply to this browser only. Backend priority chain is not modified.",
          )}
        </div>
      </header>

      <Tabs defaultValue="priority" className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full">
          <TabsTrigger value="priority">{t("admin_ai.tabs.priority", "Priority Chain")}</TabsTrigger>
          <TabsTrigger value="image">{t("admin_ai.tabs.image", "Image Models")}</TabsTrigger>
          <TabsTrigger value="prefs">{t("admin_ai.tabs.prefs", "Manual Selection")}</TabsTrigger>
          <TabsTrigger value="test">{t("admin_ai.tabs.test", "Quick Test")}</TabsTrigger>
        </TabsList>

        <TabsContent value="priority" className="mt-6">
          <PrioritySection />
        </TabsContent>
        <TabsContent value="image" className="mt-6">
          <ImageSection />
        </TabsContent>
        <TabsContent value="prefs" className="mt-6">
          <PreferencesSection />
        </TabsContent>
        <TabsContent value="test" className="mt-6">
          <QuickTestSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// 1. Priority chain + text models
// ──────────────────────────────────────────────────────────────────────

const PrioritySection = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("admin_ai.priority.heading", "Call Priority")}</CardTitle>
          <CardDescription>
            {t("admin_ai.priority.sub", "Every text generation request walks this chain top-to-bottom until a provider succeeds.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {PRIORITY.map((p, idx) => {
            const Icon = p.icon;
            return (
              <div key={p.tier} className="flex items-center gap-3">
                <div className={`shrink-0 h-12 w-12 rounded-xl bg-gradient-to-br ${p.color} flex items-center justify-center text-white shadow-soft`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{t(p.titleKey, p.titleFallback)}</div>
                  <div className="text-sm text-muted-foreground">{t(p.descKey, p.descFallback)}</div>
                </div>
                {idx < PRIORITY.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 hidden md:block" />
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("admin_ai.text.heading", "Text Generation Models")}</CardTitle>
          <CardDescription>
            {t("admin_ai.text.sub", "All text models the AI Generator may call, grouped by tier.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {PRIORITY.map((p) => {
            const models = TEXT_MODELS.filter((m) => m.tier === p.tier);
            if (models.length === 0) return null;
            return (
              <div key={p.tier} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="rounded-full">
                    {t(p.titleKey, p.titleFallback)}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{models.length} {t("admin_ai.text.models_count", "models")}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {models.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-lg border bg-card/60 p-3 flex items-start justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <code className="text-xs font-mono truncate block">{m.id}</code>
                        <div className="text-xs text-muted-foreground mt-0.5">{m.provider}</div>
                      </div>
                      {m.notes && (
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {m.notes}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
                <Separator className="mt-3" />
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────
// 2. Image models with suggested prompts
// ──────────────────────────────────────────────────────────────────────

const ImageSection = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            {t("admin_ai.image.heading", "Image Generation Models")}
          </CardTitle>
          <CardDescription>
            {t("admin_ai.image.sub", "Available image models with suggested prompts that work well for children's storybook illustrations.")}
          </CardDescription>
        </CardHeader>
      </Card>

      {IMAGE_MODELS.map((m) => (
        <Card key={m.id}>
          <CardHeader>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-lg">
                <code className="font-mono text-sm">{m.id}</code>
              </CardTitle>
              <Badge variant="outline">{m.provider}</Badge>
            </div>
            {m.notes && <CardDescription>{m.notes}</CardDescription>}
          </CardHeader>
          <CardContent>
            <div className="text-xs font-semibold text-muted-foreground mb-2">
              {t("admin_ai.image.suggested", "Suggested Prompts")}
            </div>
            <ul className="space-y-2">
              {m.suggestedPrompts.map((p, i) => (
                <li
                  key={i}
                  className="rounded-md border bg-muted/30 p-3 text-sm flex items-start gap-2"
                >
                  <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

// ──────────────────────────────────────────────────────────────────────
// 3. Manual preferences (UI-level only)
// ──────────────────────────────────────────────────────────────────────

const PreferencesSection = () => {
  const { t } = useTranslation();
  const [textModel, setTextModel] = useState<string>(
    () => localStorage.getItem(LS_TEXT) || "google/gemini-3-flash-preview",
  );
  const [imageModel, setImageModel] = useState<string>(
    () => localStorage.getItem(LS_IMAGE) || "google/gemini-2.5-flash-image",
  );

  const save = () => {
    localStorage.setItem(LS_TEXT, textModel);
    localStorage.setItem(LS_IMAGE, imageModel);
    toast.success(t("admin_ai.prefs.saved", "Preferences saved (this browser only)."));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("admin_ai.prefs.heading", "Manual Model Selection")}</CardTitle>
        <CardDescription>
          {t(
            "admin_ai.prefs.sub",
            "Pick a preferred text and image model. Stored locally in this browser — does not change backend routing.",
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label>{t("admin_ai.prefs.text_label", "Preferred Text Model")}</Label>
          <Select value={textModel} onValueChange={setTextModel}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {TEXT_MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <span className="font-mono text-xs">{m.id}</span>
                  <span className="text-muted-foreground ml-2">— {m.provider}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>{t("admin_ai.prefs.image_label", "Preferred Image Model")}</Label>
          <Select value={imageModel} onValueChange={setImageModel}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IMAGE_MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <span className="font-mono text-xs">{m.id}</span>
                  <span className="text-muted-foreground ml-2">— {m.provider}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={save} className="gap-2">
          <Save className="h-4 w-4" />
          {t("admin_ai.prefs.save", "Save Preferences")}
        </Button>
      </CardContent>
    </Card>
  );
};

// ──────────────────────────────────────────────────────────────────────
// 4. Quick test — uses ai-assistant edge function (no backend changes)
//    Parses streamed OpenRouter SSE to extract model + measure latency.
// ──────────────────────────────────────────────────────────────────────

const QuickTestSection = () => {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [modelUsed, setModelUsed] = useState<string>("");
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [ttfbMs, setTtfbMs] = useState<number | null>(null);

  const samplePrompts = useMemo(
    () => [
      t("admin_ai.test.sample1", "Tell me a short magical bedtime line about a sleepy dragon."),
      t("admin_ai.test.sample2", "Suggest a 2-sentence story idea for a 6-year-old about courage."),
      t("admin_ai.test.sample3", "What does the AI Storyteller feature do on this website?"),
    ],
    [t],
  );

  const run = async () => {
    if (!prompt.trim()) {
      toast.error(t("admin_ai.test.need_prompt", "Please enter a prompt."));
      return;
    }
    setLoading(true);
    setReply("");
    setModelUsed("");
    setLatencyMs(null);
    setTtfbMs(null);

    const started = performance.now();
    let firstByteAt: number | null = null;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!res.ok || !res.body) {
        const txt = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
      }

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (firstByteAt === null) {
          firstByteAt = performance.now();
          setTtfbMs(Math.round(firstByteAt - started));
        }
        buffer += value;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const json = JSON.parse(payload);
            if (json.model && !modelUsed) setModelUsed(json.model);
            const delta = json.choices?.[0]?.delta?.content;
            if (typeof delta === "string") {
              accumulated += delta;
              setReply(accumulated);
            }
          } catch {
            // ignore non-JSON SSE frames
          }
        }
      }
      setLatencyMs(Math.round(performance.now() - started));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(t("admin_ai.test.failed", "Test failed: ") + msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlayCircle className="h-5 w-5 text-primary" />
          {t("admin_ai.test.heading", "Quick Test")}
        </CardTitle>
        <CardDescription>
          {t(
            "admin_ai.test.sub",
            "Send a test prompt through the AI Generator pipeline and see which model responded plus end-to-end latency.",
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {samplePrompts.map((s, i) => (
            <Button
              key={i}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPrompt(s)}
              className="text-xs"
            >
              {t("admin_ai.test.sample_btn", "Sample")} {i + 1}
            </Button>
          ))}
        </div>

        <div className="space-y-2">
          <Label>{t("admin_ai.test.prompt_label", "Test Prompt")}</Label>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder={t("admin_ai.test.placeholder", "Type a prompt to test the AI…")}
          />
        </div>

        <Button onClick={run} disabled={loading} className="gap-2">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <PlayCircle className="h-4 w-4" />
          )}
          {loading
            ? t("admin_ai.test.running", "Running…")
            : t("admin_ai.test.run", "Run Test")}
        </Button>

        {(modelUsed || latencyMs !== null) && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <Card className="bg-muted/30">
              <CardContent className="pt-5">
                <div className="text-xs text-muted-foreground mb-1">
                  {t("admin_ai.test.model_used", "Model used")}
                </div>
                <code className="text-sm font-mono break-all">
                  {modelUsed || "—"}
                </code>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="pt-5">
                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {t("admin_ai.test.ttfb", "Time to first byte")}
                </div>
                <div className="text-lg font-semibold">
                  {ttfbMs !== null ? `${ttfbMs} ms` : "—"}
                </div>
              </CardContent>
            </Card>
            <Card className="bg-muted/30">
              <CardContent className="pt-5">
                <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {t("admin_ai.test.total", "Total response time")}
                </div>
                <div className="text-lg font-semibold">
                  {latencyMs !== null ? `${latencyMs} ms` : "—"}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {reply && (
          <div className="space-y-2">
            <Label>{t("admin_ai.test.reply", "Response")}</Label>
            <div className="rounded-lg border bg-card/60 p-4 text-sm whitespace-pre-wrap leading-relaxed">
              {reply}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
