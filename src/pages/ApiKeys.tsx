import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Key, Trash2, Plus, Eye, EyeOff, Sparkles, Image as ImageIcon, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";

type Provider = "openai" | "google" | "openrouter" | "anthropic" | "stability" | "replicate" | "custom";

interface KeyRow {
  id: string;
  provider: Provider;
  label: string | null;
  api_key: string;
  base_url: string | null;
  text_model: string | null;
  image_model: string | null;
  capabilities: string[];
  enabled: boolean;
  created_at: string;
}

const PROVIDER_INFO: Record<Provider, { name: string; helpKey: string; helpDefault: string; defaults: { text?: string; image?: string }; supports: ("text" | "image")[] }> = {
  openai: {
    name: "OpenAI",
    helpKey: "page_api_keys.help.openai",
    helpDefault: "Get a key at platform.openai.com → API keys",
    defaults: { text: "gpt-4o-mini", image: "gpt-image-1" },
    supports: ["text", "image"],
  },
  google: {
    name: "Google Gemini",
    helpKey: "page_api_keys.help.google",
    helpDefault: "Get a key at aistudio.google.com/apikey",
    defaults: { text: "gemini-2.5-flash", image: "gemini-2.5-flash-image" },
    supports: ["text", "image"],
  },
  openrouter: {
    name: "OpenRouter",
    helpKey: "page_api_keys.help.openrouter",
    helpDefault: "Get a key at openrouter.ai/keys (text only)",
    defaults: { text: "openai/gpt-4o-mini" },
    supports: ["text"],
  },
  anthropic: {
    name: "Anthropic Claude",
    helpKey: "page_api_keys.help.anthropic",
    helpDefault: "console.anthropic.com — text only",
    defaults: { text: "claude-3-5-sonnet-latest" },
    supports: ["text"],
  },
  stability: {
    name: "Stability AI",
    helpKey: "page_api_keys.help.stability",
    helpDefault: "platform.stability.ai — images only",
    defaults: {},
    supports: ["image"],
  },
  replicate: {
    name: "Replicate",
    helpKey: "page_api_keys.help.replicate",
    helpDefault: "replicate.com — images only",
    defaults: {},
    supports: ["image"],
  },
  custom: {
    name: "Custom (OpenAI-compatible)",
    helpKey: "page_api_keys.help.custom",
    helpDefault: "Any OpenAI-compatible API. Provide Base URL.",
    defaults: {},
    supports: ["text", "image"],
  },
};

const ApiKeys = () => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  const { user } = useAuth();
  const qc = useQueryClient();
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [adding, setAdding] = useState(false);

  // form state
  const [provider, setProvider] = useState<Provider>("openai");
  const [apiKey, setApiKey] = useState("");
  const [label, setLabel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [textModel, setTextModel] = useState("");
  const [imageModel, setImageModel] = useState("");
  const [capText, setCapText] = useState(true);
  const [capImage, setCapImage] = useState(true);
  const [saving, setSaving] = useState(false);

  const q = useQuery<KeyRow[]>({
    queryKey: ["user-api-keys", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_api_keys")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as KeyRow[];
    },
  });

  if (!user) {
    return (
      <div className="py-20 text-center">
        <p>{t("page_api_keys.sign_in_to_manage_your_api_keys", "Sign in to manage your API keys")}</p>
      </div>
    );
  }

  const resetForm = () => {
    setProvider("openai");
    setApiKey("");
    setLabel("");
    setBaseUrl("");
    setTextModel("");
    setImageModel("");
    setCapText(true);
    setCapImage(true);
    setAdding(false);
  };

  const onSave = async () => {
    if (!apiKey.trim()) {
      toast({ title: t("page_api_keys.enter_the_api_key", "Enter the API key"), variant: "destructive" });
      return;
    }
    const info = PROVIDER_INFO[provider];
    const caps: string[] = [];
    if (capText && info.supports.includes("text")) caps.push("text");
    if (capImage && info.supports.includes("image")) caps.push("image");
    if (caps.length === 0) {
      toast({ title: t("page_api_keys.pick_at_least_one_capability", "Pick at least one capability"), variant: "destructive" });
      return;
    }
    if (provider === "custom" && !baseUrl.trim()) {
      toast({ title: t("page_api_keys.base_url_is_required", "Base URL is required"), variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("user_api_keys").insert({
      user_id: user.id,
      provider,
      label: label.trim() || null,
      api_key: apiKey.trim(),
      base_url: baseUrl.trim() || null,
      text_model: textModel.trim() || info.defaults.text || null,
      image_model: imageModel.trim() || info.defaults.image || null,
      capabilities: caps,
      enabled: true,
    });
    setSaving(false);
    if (error) {
      toast({
        title: t("page_api_keys.save_failed", "Save failed"),
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    toast({ title: t("page_api_keys.saved", "Saved") });
    resetForm();
    qc.invalidateQueries({ queryKey: ["user-api-keys", user.id] });
  };

  const onDelete = async (id: string) => {
    if (!confirm(t("page_api_keys.delete_this_key", "Delete this key?"))) return;
    const { error } = await supabase.from("user_api_keys").delete().eq("id", id);
    if (error) {
      toast({ title: t("page_api_keys.error", "Error"), description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["user-api-keys", user.id] });
  };

  const onToggle = async (id: string, enabled: boolean) => {
    const { error } = await supabase.from("user_api_keys").update({ enabled }).eq("id", id);
    if (error) {
      toast({ title: t("page_api_keys.error", "Error"), description: error.message, variant: "destructive" });
      return;
    }
    qc.invalidateQueries({ queryKey: ["user-api-keys", user.id] });
  };

  const info = PROVIDER_INFO[provider];

  return (
    <div className="max-w-3xl mx-auto py-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Key className="h-6 w-6 text-primary" />
          {t("page_api_keys.your_ai_api_keys", "Your AI API Keys")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("page_api_keys.add_your_own_keys_from_openai_gemini_ope", "Add your own keys from OpenAI / Gemini / OpenRouter — story text, illustrations, and PDFs will use them so credits go on your account. Without a key the system falls back to Lovable AI.")}
        </p>
        <div className="text-xs flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>
            {t("page_api_keys.keys_are_stored_under_rls_only_you_can_r", "Keys are stored under RLS — only you can read them. Make sure you understand the usage limits on your provider account.")}
          </span>
        </div>
      </div>

      {/* List */}
      <div className="space-y-3">
        {q.isLoading && (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        )}
        {q.data?.length === 0 && !adding && (
          <Card className="p-6 text-center text-muted-foreground">
            {t("page_api_keys.no_keys_added_yet", "No keys added yet")}
          </Card>
        )}
        {q.data?.map((k) => (
          <Card key={k.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold">{PROVIDER_INFO[k.provider]?.name ?? k.provider}</span>
                {k.label && <span className="text-xs text-muted-foreground">({k.label})</span>}
                {k.capabilities.includes("text") && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> {t("page_api_keys.text", "Text")}
                  </span>
                )}
                {k.capabilities.includes("image") && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 flex items-center gap-1">
                    <ImageIcon className="h-3 w-3" /> {t("page_api_keys.images", "Images")}
                  </span>
                )}
              </div>
              <div className="text-xs font-mono break-all text-muted-foreground">
                {show[k.id] ? k.api_key : k.api_key.slice(0, 6) + "•••••" + k.api_key.slice(-4)}
                <button onClick={() => setShow((s) => ({ ...s, [k.id]: !s[k.id] }))} className="ml-2 inline-flex">
                  {show[k.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </button>
              </div>
              {(k.text_model || k.image_model) && (
                <div className="text-xs text-muted-foreground">
                  {k.text_model && <span>text: <code>{k.text_model}</code></span>}
                  {k.text_model && k.image_model && " · "}
                  {k.image_model && <span>image: <code>{k.image_model}</code></span>}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={k.enabled} onCheckedChange={(v) => onToggle(k.id, v)} />
              <Button variant="ghost" size="icon" onClick={() => onDelete(k.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Add form */}
      {!adding ? (
        <Button onClick={() => setAdding(true)} className="gap-2">
          <Plus className="h-4 w-4" /> {t("page_api_keys.add_key", "Add key")}
        </Button>
      ) : (
        <Card className="p-5 space-y-4">
          <h2 className="font-bold">{t("page_api_keys.new_key", "New key")}</h2>

          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <Label>{t("page_api_keys.provider", "Provider")}</Label>
              <Select value={provider} onValueChange={(v) => setProvider(v as Provider)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PROVIDER_INFO) as Provider[]).map((p) => (
                    <SelectItem key={p} value={p}>{PROVIDER_INFO[p].name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">{t(info.helpKey, info.helpDefault)}</p>
            </div>
            <div>
              <Label>{t("page_api_keys.label_optional", "Label (optional)")}</Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={12} placeholder="personal" />
            </div>
          </div>

          <div>
            <Label>{t("page_api_keys.api_key", "API Key")}</Label>
            <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." autoComplete="off" />
          </div>

          {provider === "custom" && (
            <div>
              <Label>Base URL</Label>
              <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.example.com/v1/chat/completions" />
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-3">
            {info.supports.includes("text") && (
              <div>
                <Label>{t("page_api_keys.text_model", "Text model")}</Label>
                <Input value={textModel} onChange={(e) => setTextModel(e.target.value)} placeholder={info.defaults.text ?? ""} />
              </div>
            )}
            {info.supports.includes("image") && (
              <div>
                <Label>{t("page_api_keys.image_model", "Image model")}</Label>
                <Input value={imageModel} onChange={(e) => setImageModel(e.target.value)} placeholder={info.defaults.image ?? ""} />
              </div>
            )}
          </div>

          <div className="flex items-center gap-6 flex-wrap">
            {info.supports.includes("text") && (
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={capText} onCheckedChange={setCapText} />
                <Sparkles className="h-4 w-4" /> {t("page_api_keys.use_for_text_generation", "Use for text generation")}
              </label>
            )}
            {info.supports.includes("image") && (
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={capImage} onCheckedChange={setCapImage} />
                <ImageIcon className="h-4 w-4" /> {t("page_api_keys.use_for_image_generation", "Use for image generation")}
              </label>
            )}
          </div>

          <div className="flex gap-2">
            <Button onClick={onSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("page_api_keys.save", "Save")}
            </Button>
            <Button variant="ghost" onClick={resetForm}>{t("page_api_keys.cancel", "Cancel")}</Button>
          </div>
        </Card>
      )}
    </div>
  );
};

export default ApiKeys;
