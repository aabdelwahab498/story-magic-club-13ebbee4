import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, User as UserIcon, Save, KeyRound, Eye, EyeOff, Trash2, ShieldCheck, Lock, History, BookOpen, Headphones, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMyAiStoriesPage, type AiStoryRow } from "@/lib/aiStoryApi";
import Seo from "@/components/Seo";
import PaddleSubscriptionCard from "@/components/PaddleSubscriptionCard";

type ProviderId = "openai" | "openrouter";

interface KeyRow {
  provider: ProviderId;
  enabled: boolean;
  key_last4: string | null;
  last_validated_at: string | null;
  validation_status: string | null;
}

const PROVIDERS: { id: ProviderId; label: string; placeholder: string; help: string }[] = [
  {
    id: "openai",
    label: "OpenAI API Key",
    placeholder: "sk-...",
    help: "Find your key at platform.openai.com/api-keys.",
  },
  {
    id: "openrouter",
    label: "OpenRouter API Key",
    placeholder: "sk-or-...",
    help: "Find your key at openrouter.ai/keys.",
  },
];

const AccountProfile = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [historyLimit, setHistoryLimit] = useState(5);
  const { data: recentStories = [], isLoading: storiesLoading, isFetching: storiesFetching } =
    useMyAiStories(!!user, historyLimit);
  const canLoadMore = recentStories.length >= historyLimit;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");

  // API keys state — note: we NEVER hold the saved key in state, only the
  // input buffer for the form (which is cleared the moment we hand it off).
  const [keyRows, setKeyRows] = useState<Record<ProviderId, KeyRow | null>>({
    openai: null,
    openrouter: null,
  });
  const [inputs, setInputs] = useState<Record<ProviderId, string>>({
    openai: "",
    openrouter: "",
  });
  const [reveal, setReveal] = useState<Record<ProviderId, boolean>>({
    openai: false,
    openrouter: false,
  });
  const [pending, setPending] = useState<Record<ProviderId, boolean>>({
    openai: false,
    openrouter: false,
  });

  const loadKeys = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("user_api_keys")
      .select("provider, enabled, key_last4, last_validated_at, validation_status")
      .eq("user_id", user.id)
      .in("provider", ["openai", "openrouter"]);
    const next: Record<ProviderId, KeyRow | null> = { openai: null, openrouter: null };
    (data ?? []).forEach((row: any) => {
      if (row.provider === "openai" || row.provider === "openrouter") {
        next[row.provider as ProviderId] = row as KeyRow;
      }
    });
    setKeyRows(next);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const [{ data, error }] = await Promise.all([
        supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", user.id)
          .maybeSingle(),
        loadKeys(),
      ]);
      if (cancelled) return;
      if (error) toast.error(t("common.error", "Something went wrong"));
      setDisplayName(data?.display_name ?? "");
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, t, loadKeys]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const trimmed = displayName.trim();
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: trimmed || null })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error(t("profile.save_failed", "Could not save your profile"));
      return;
    }
    toast.success(t("profile.saved", "Profile updated"));
  };

  const handleSaveKey = async (provider: ProviderId) => {
    const apiKey = inputs[provider].trim();
    if (apiKey.length < 20) {
      toast.error("That API key looks too short — double-check and try again.");
      return;
    }
    setPending((p) => ({ ...p, [provider]: true }));
    try {
      const { data, error } = await supabase.functions.invoke("manage-user-api-key", {
        body: { action: "save", provider, apiKey },
      });
      if (error || (data as any)?.error) {
        const code = (data as any)?.error ?? error?.message;
        if (code === "tier_required") {
          toast.error("Personal API keys require the Pro Creator or Elite Publisher plan.");
        } else if (code === "invalid_api_key") {
          toast.error("That API key was rejected by the provider.");
        } else {
          toast.error("Could not save key. Please try again.");
        }
        return;
      }
      // Clear the input + reveal flag the instant the request resolves.
      setInputs((p) => ({ ...p, [provider]: "" }));
      setReveal((p) => ({ ...p, [provider]: false }));
      toast.success("Key saved securely and validated.");
      await loadKeys();
    } finally {
      setPending((p) => ({ ...p, [provider]: false }));
    }
  };

  const handleDeleteKey = async (provider: ProviderId) => {
    setPending((p) => ({ ...p, [provider]: true }));
    try {
      const { error } = await supabase.functions.invoke("manage-user-api-key", {
        body: { action: "delete", provider },
      });
      if (error) {
        toast.error("Could not remove key.");
        return;
      }
      toast.success("Key removed.");
      await loadKeys();
    } finally {
      setPending((p) => ({ ...p, [provider]: false }));
    }
  };

  const handleToggleKey = async (provider: ProviderId, enabled: boolean) => {
    setPending((p) => ({ ...p, [provider]: true }));
    try {
      const { error } = await supabase.functions.invoke("manage-user-api-key", {
        body: { action: "toggle", provider, enabled },
      });
      if (error) {
        toast.error("Could not update key.");
        return;
      }
      await loadKeys();
    } finally {
      setPending((p) => ({ ...p, [provider]: false }));
    }
  };

  return (
    <div className="py-6 max-w-2xl mx-auto px-4 space-y-6">
      <Seo
        title="Profile — NajmaH"
        description="Manage your display name, API keys, and how your stories are attributed."
      />
      <header className="mb-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground flex items-center gap-2">
          <UserIcon className="h-6 w-6 text-primary" />
          {t("profile.title", "Your Profile")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "profile.subtitle",
            "Your display name appears on stories you publish to the community.",
          )}
        </p>
      </header>

      <Card className="p-5 sm:p-6">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">{t("profile.email", "Email")}</Label>
              <Input id="email" value={user?.email ?? ""} disabled />
            </div>

            <div className="space-y-2">
              <Label htmlFor="display_name">
                {t("profile.display_name", "Display name")}
              </Label>
              <Input
                id="display_name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t(
                  "profile.display_name_placeholder",
                  "How should we credit you?",
                )}
                maxLength={60}
              />
              <p className="text-xs text-muted-foreground">
                {t(
                  "profile.display_name_help",
                  "Shown as “Written by …” on published community stories. Leave empty to use your account name.",
                )}
              </p>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {t("common.save", "Save")}
              </Button>
            </div>
          </form>
        )}
      </Card>

      <PaddleSubscriptionCard />

      <Card className="p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              {t("profile.history_title", { defaultValue: "Story history" })}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t("profile.history_subtitle", {
                defaultValue: "All stories you generated are saved here.",
              })}
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="gap-1">
            <Link to="/my-stories">
              {t("profile.history_view_all", { defaultValue: "View all" })}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        {storiesLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : recentStories.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
            {t("profile.history_empty", {
              defaultValue: "You haven't generated any stories yet.",
            })}
            <div className="mt-3">
              <Button asChild size="sm">
                <Link to="/ai-storyteller">
                  {t("profile.history_create", { defaultValue: "Create your first story" })}
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {recentStories.map((s) => (
                <li key={s.id} className="py-3 flex items-center gap-3">
                  <Link
                    to={`/my-stories/${s.id}`}
                    className="flex-1 min-w-0 hover:opacity-80 transition-opacity"
                  >
                    <p className="font-semibold text-foreground truncate">
                      {s.title || t("profile.history_untitled", { defaultValue: "Untitled story" })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(s.created_at).toLocaleDateString(i18n.language)} •{" "}
                      {s.language.toUpperCase()}
                      {s.audio_url && (
                        <span className="ms-2 inline-flex items-center gap-1 text-primary font-semibold">
                          <Headphones className="h-3 w-3" />
                          {t("profile.history_audio", { defaultValue: "Audio" })}
                        </span>
                      )}
                    </p>
                  </Link>
                  <Button asChild variant="ghost" size="sm">
                    <Link to={`/my-stories/${s.id}`}>
                      {t("profile.history_open", { defaultValue: "Open" })}
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
            {canLoadMore && (
              <div className="flex justify-center pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setHistoryLimit((n) => n + 10)}
                  disabled={storiesFetching}
                  className="gap-2"
                >
                  {storiesFetching && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t("profile.history_load_more", { defaultValue: "Load more" })}
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      <Card className="p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            API Settings
          </h2>
          <p className="text-sm text-muted-foreground mt-1 flex items-start gap-2">
            <Lock className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
            <span>
              Bring your own API keys (BYOK). Keys are encrypted at rest with AES-GCM and never
              returned to the browser after saving. Available on{" "}
              <strong>Pro Creator</strong> and <strong>Elite Publisher</strong> plans.
            </span>
          </p>
        </div>

        {PROVIDERS.map((p) => {
          const row = keyRows[p.id];
          const isPending = pending[p.id];
          return (
            <div key={p.id} className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label className="font-semibold">{p.label}</Label>
                {row?.key_last4 ? (
                  <Badge variant="secondary" className="gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    •••• {row.key_last4}
                  </Badge>
                ) : (
                  <Badge variant="outline">Not set</Badge>
                )}
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={reveal[p.id] ? "text" : "password"}
                    value={inputs[p.id]}
                    onChange={(e) =>
                      setInputs((s) => ({ ...s, [p.id]: e.target.value }))
                    }
                    placeholder={row ? "Enter a new key to rotate…" : p.placeholder}
                    autoComplete="off"
                    spellCheck={false}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setReveal((s) => ({ ...s, [p.id]: !s[p.id] }))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={reveal[p.id] ? "Hide key" : "Show key"}
                  >
                    {reveal[p.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  type="button"
                  onClick={() => handleSaveKey(p.id)}
                  disabled={isPending || inputs[p.id].trim().length < 20}
                  className="gap-2"
                >
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">{p.help}</p>

              {row && (
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={row.enabled}
                      onCheckedChange={(v) => handleToggleKey(p.id, v)}
                      disabled={isPending}
                    />
                    <span className="text-sm text-muted-foreground">
                      {row.enabled ? "Active — used in the AI pipeline" : "Disabled"}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteKey(p.id)}
                    disabled={isPending}
                    className="text-destructive hover:text-destructive gap-1"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
};

export default AccountProfile;
