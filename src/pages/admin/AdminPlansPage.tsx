import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Save, Crown, Image as ImageIcon, FileText, Headphones, Power, Zap, Plus, Trash2, AlertTriangle, Star } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { fetchAllPlans, updatePlan, type SubscriptionPlan } from "@/lib/subscriptionApi";
import { supabase } from "@/integrations/supabase/client";

const tierColor: Record<string, string> = {
  free: "from-slate-400 to-slate-500",
  parent: "from-sky-500 to-blue-500",
  family: "from-emerald-500 to-teal-500",
  growth: "from-violet-500 to-fuchsia-500",
  pro: "from-amber-400 to-orange-500",
  premium: "from-amber-400 to-orange-500",
};

export default function AdminPlansPage() {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const seedPaddle = async () => {
    setSeeding(true);
    try {
      const { data, error } = await supabase.functions.invoke("paddle-seed-products", { method: "POST" });
      if (error) throw error;
      toast.success("Paddle products synced");
      console.log("paddle-seed-products result", data);
      await load();
    } catch (e: any) {
      toast.error(e?.message ?? "Sync failed");
    } finally {
      setSeeding(false);
    }
  };

  const load = async () => {
    try {
      setLoading(true);
      setPlans(await fetchAllPlans());
    } catch (e) {
      console.error(e);
      toast.error(t("admin_plans.failed_to_load_plans", "Failed to load plans"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const patch = (id: string, p: Partial<SubscriptionPlan>) =>
    setPlans((prev) => prev.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const save = async (plan: SubscriptionPlan) => {
    setSaving(plan.id);
    try {
      await updatePlan(plan.id, {
        name: plan.name ?? {},
        description: plan.description ?? {},
        features: plan.features ?? [],
        price_egp: Number(plan.price_egp) || 0,
        price_usd: Number(plan.price_usd) || 0,
        monthly_story_limit: Number(plan.monthly_story_limit) || 0,
        daily_story_limit: Number(plan.daily_story_limit) || 0,
        illustration_credits: Number(plan.illustration_credits) || 0,
        allow_illustrations: !!plan.allow_illustrations,
        allow_pdf: !!plan.allow_pdf,
        allow_audio: !!plan.allow_audio,
        active: !!plan.active,
        sort_order: Number(plan.sort_order) || 0,
        paddle_price_id: plan.paddle_price_id?.trim() || null,
        paddle_product_id: plan.paddle_product_id?.trim() || null,
        is_featured: !!plan.is_featured,
      });
      toast.success(t("admin_plans.saved", "Saved — changes are live on /pricing"));
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? t("admin_plans.save_failed", "Save failed"));
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center">
        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <Crown className="h-6 w-6 text-primary" />
            {t("admin_plans.subscription_plans", "Subscription Plans")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("admin_plans.live_hint", "Everything you edit here is wired directly to the public /pricing page and the Paddle checkout.")}
          </p>
        </div>
        <Button onClick={seedPaddle} disabled={seeding} variant="outline" className="gap-2">
          {seeding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          Sync Paddle products
        </Button>
      </header>

      {(() => {
        const missing = plans.filter(
          (p) => p.tier !== "free" && p.active && !p.paddle_price_id?.trim(),
        );
        if (missing.length === 0) return null;
        return (
          <div className="flex items-start gap-3 rounded-2xl border-2 border-amber-400/60 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-900 dark:text-amber-200">
                Paddle Price ID missing on {missing.length} paid plan{missing.length > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-amber-800/80 dark:text-amber-200/80 mt-1">
                Users will not be able to check out on:{" "}
                <span className="font-mono">{missing.map((m) => m.tier).join(", ")}</span>.
                Paste the IDs from Paddle (or click "Sync Paddle products") and save.
              </p>
            </div>
          </div>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {plans.map((plan) => (
          <Card key={plan.id} className="p-5 space-y-4 border-2">
            <div className={`-m-5 mb-2 px-5 py-3 rounded-t-lg bg-gradient-to-r ${tierColor[plan.tier] ?? "from-primary to-primary"} text-white`}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold capitalize">{plan.tier}</h3>
                <span className="text-xs font-semibold opacity-90">
                  {(isAr ? plan.name?.ar : plan.name?.en) ?? plan.tier}
                </span>
              </div>
            </div>

            {/* Names */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Name (EN)</Label>
                <Input
                  value={plan.name?.en ?? ""}
                  onChange={(e) => patch(plan.id, { name: { ...plan.name, en: e.target.value } })}
                />
              </div>
              <div>
                <Label className="text-xs">Name (AR)</Label>
                <Input
                  dir="rtl"
                  value={plan.name?.ar ?? ""}
                  onChange={(e) => patch(plan.id, { name: { ...plan.name, ar: e.target.value } })}
                />
              </div>
            </div>

            {/* Descriptions */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Description (EN)</Label>
                <Textarea
                  rows={2}
                  value={plan.description?.en ?? ""}
                  onChange={(e) => patch(plan.id, { description: { ...plan.description, en: e.target.value } })}
                />
              </div>
              <div>
                <Label className="text-xs">Description (AR)</Label>
                <Textarea
                  dir="rtl"
                  rows={2}
                  value={plan.description?.ar ?? ""}
                  onChange={(e) => patch(plan.id, { description: { ...plan.description, ar: e.target.value } })}
                />
              </div>
            </div>

            {/* Pricing */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t("admin_plans.price_usd", "Price (USD)")}</Label>
                <Input
                  type="number" min={0} step="0.01"
                  value={plan.price_usd ?? 0}
                  onChange={(e) => patch(plan.id, { price_usd: Number(e.target.value) })}
                  disabled={plan.tier === "free"}
                />
              </div>
              <div>
                <Label className="text-xs">Price (EGP)</Label>
                <Input
                  type="number" min={0}
                  value={plan.price_egp ?? 0}
                  onChange={(e) => patch(plan.id, { price_egp: Number(e.target.value) })}
                  disabled={plan.tier === "free"}
                />
              </div>
            </div>

            {/* Paddle IDs */}
            <div className="grid grid-cols-1 gap-3 p-3 rounded-lg bg-violet-500/5 border border-violet-500/20">
              <div>
                <Label className="text-xs font-semibold text-violet-600 dark:text-violet-300">Paddle Price ID</Label>
                <Input
                  placeholder="pri_01abc…"
                  value={plan.paddle_price_id ?? ""}
                  onChange={(e) => patch(plan.id, { paddle_price_id: e.target.value })}
                  disabled={plan.tier === "free"}
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Required for card checkout on /pricing.
                </p>
              </div>
              <div>
                <Label className="text-xs">Paddle Product ID (optional)</Label>
                <Input
                  placeholder="pro_01abc…"
                  value={plan.paddle_product_id ?? ""}
                  onChange={(e) => patch(plan.id, { paddle_product_id: e.target.value })}
                  disabled={plan.tier === "free"}
                />
              </div>
            </div>

            {/* Limits */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">{t("admin_plans.monthly_story_limit", "Monthly limit")}</Label>
                <Input
                  type="number" min={0}
                  value={plan.monthly_story_limit ?? 0}
                  onChange={(e) => patch(plan.id, { monthly_story_limit: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label className="text-xs">Daily limit</Label>
                <Input
                  type="number" min={0}
                  value={plan.daily_story_limit ?? 0}
                  onChange={(e) => patch(plan.id, { daily_story_limit: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label className="text-xs">Illust. credits</Label>
                <Input
                  type="number" min={0}
                  value={plan.illustration_credits ?? 0}
                  onChange={(e) => patch(plan.id, { illustration_credits: Number(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Sort order</Label>
              <Input
                type="number"
                value={plan.sort_order ?? 0}
                onChange={(e) => patch(plan.id, { sort_order: Number(e.target.value) })}
              />
            </div>

            {/* Features list */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Features (shown on /pricing)</Label>
                <Button
                  type="button" size="sm" variant="ghost"
                  onClick={() => patch(plan.id, { features: [...(plan.features ?? []), { en: "", ar: "" }] })}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add
                </Button>
              </div>
              {(plan.features ?? []).map((f, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                  <Input
                    placeholder="English"
                    value={f.en ?? ""}
                    onChange={(e) => {
                      const next = [...(plan.features ?? [])];
                      next[i] = { ...next[i], en: e.target.value };
                      patch(plan.id, { features: next });
                    }}
                  />
                  <Input
                    dir="rtl" placeholder="عربي"
                    value={f.ar ?? ""}
                    onChange={(e) => {
                      const next = [...(plan.features ?? [])];
                      next[i] = { ...next[i], ar: e.target.value };
                      patch(plan.id, { features: next });
                    }}
                  />
                  <Button
                    type="button" size="icon" variant="ghost"
                    onClick={() => patch(plan.id, { features: (plan.features ?? []).filter((_, j) => j !== i) })}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Toggles */}
            <div className="space-y-2 pt-2 border-t">
              <FeatureToggle icon={<ImageIcon className="h-4 w-4" />} label={t("admin_plans.illustrations", "Illustrations")} checked={plan.allow_illustrations} onChange={(v) => patch(plan.id, { allow_illustrations: v })} />
              <FeatureToggle icon={<FileText className="h-4 w-4" />} label={t("admin_plans.download_pdf", "Download PDF")} checked={plan.allow_pdf} onChange={(v) => patch(plan.id, { allow_pdf: v })} />
              <FeatureToggle icon={<Headphones className="h-4 w-4" />} label={t("admin_plans.audio_book_elevenlabs", "Audio Book")} checked={plan.allow_audio} onChange={(v) => patch(plan.id, { allow_audio: v })} />
              <FeatureToggle icon={<Star className="h-4 w-4" />} label={'Show as "Most popular"'} checked={!!plan.is_featured} onChange={(v) => patch(plan.id, { is_featured: v })} />
              <FeatureToggle icon={<Power className="h-4 w-4" />} label={t("admin_plans.plan_active", "Plan active (show on /pricing)")} checked={plan.active} onChange={(v) => patch(plan.id, { active: v })} />
            </div>

            <Button className="w-full" onClick={() => save(plan)} disabled={saving === plan.id}>
              {saving === plan.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              {t("admin_plans.save", "Save")}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

function FeatureToggle({ icon, label, checked, onChange }: { icon: React.ReactNode; label: string; checked: boolean; onChange: (v: boolean) => void; }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2 text-sm font-medium">{icon}{label}</div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
