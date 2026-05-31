import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Save, Crown, Image as ImageIcon, FileText, Headphones, Power, Zap } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { fetchAllPlans, updatePlan, type SubscriptionPlan } from "@/lib/subscriptionApi";
import { supabase } from "@/integrations/supabase/client";

const tierColor: Record<string, string> = {
  free: "from-slate-400 to-slate-500",
  family: "from-emerald-500 to-teal-500",
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

  useEffect(() => {
    load();
  }, []);

  const patch = (id: string, p: Partial<SubscriptionPlan>) =>
    setPlans((prev) => prev.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const save = async (plan: SubscriptionPlan) => {
    setSaving(plan.id);
    try {
      await updatePlan(plan.id, {
        price_egp: Number(plan.price_egp) || 0,
        price_usd: Number(plan.price_usd) || 0,
        monthly_story_limit: Number(plan.monthly_story_limit) || 0,
        allow_illustrations: !!plan.allow_illustrations,
        allow_pdf: !!plan.allow_pdf,
        allow_audio: !!plan.allow_audio,
        active: !!plan.active,
        sort_order: Number(plan.sort_order) || 0,
      });
      toast.success(t("admin_plans.saved", "Saved"));
    } catch (e) {
      console.error(e);
      toast.error(t("admin_plans.save_failed", "Save failed"));
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
      <header>
        <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
          <Crown className="h-6 w-6 text-primary" />
          {t("admin_plans.subscription_plans", "Subscription Plans")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("admin_plans.control_pricing_monthly_story_limits_and", "Control pricing, monthly story limits, and paid features (illustrations, PDF, audio).")}
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">{t("admin_plans.price_egp", "Price (EGP)")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={plan.price_egp}
                  onChange={(e) => patch(plan.id, { price_egp: Number(e.target.value) })}
                  disabled={plan.tier === "free"}
                />
              </div>
              <div>
                <Label className="text-xs">{t("admin_plans.price_usd", "Price (USD)")}</Label>
                <Input
                  type="number"
                  min={0}
                  value={plan.price_usd}
                  onChange={(e) => patch(plan.id, { price_usd: Number(e.target.value) })}
                  disabled={plan.tier === "free"}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">
                {t("admin_plans.monthly_story_limit", "Monthly story limit")}
              </Label>
              <Input
                type="number"
                min={0}
                value={plan.monthly_story_limit}
                onChange={(e) => patch(plan.id, { monthly_story_limit: Number(e.target.value) })}
              />
            </div>

            <div className="space-y-2 pt-2 border-t">
              <FeatureToggle
                icon={<ImageIcon className="h-4 w-4" />}
                label={t("admin_plans.illustrations", "Illustrations")}
                checked={plan.allow_illustrations}
                onChange={(v) => patch(plan.id, { allow_illustrations: v })}
              />
              <FeatureToggle
                icon={<FileText className="h-4 w-4" />}
                label={t("admin_plans.download_pdf", "Download PDF")}
                checked={plan.allow_pdf}
                onChange={(v) => patch(plan.id, { allow_pdf: v })}
              />
              <FeatureToggle
                icon={<Headphones className="h-4 w-4" />}
                label={t("admin_plans.audio_book_elevenlabs", "Audio Book (ElevenLabs)")}
                checked={plan.allow_audio}
                onChange={(v) => patch(plan.id, { allow_audio: v })}
              />
              <FeatureToggle
                icon={<Power className="h-4 w-4" />}
                label={t("admin_plans.plan_active", "Plan active")}
                checked={plan.active}
                onChange={(v) => patch(plan.id, { active: v })}
              />
            </div>

            <PermissionsPreview plan={plan} isAr={!!isAr} />

            <Button
              className="w-full"
              onClick={() => save(plan)}
              disabled={saving === plan.id}
            >
              {saving === plan.id ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {t("admin_plans.save", "Save")}
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

function PermissionsPreview({ plan }: { plan: SubscriptionPlan; isAr?: boolean }) {
  const { t } = useTranslation();
  const limit = Number(plan.monthly_story_limit) || 0;
  const unlimited = limit >= 999;
  const limitText = unlimited
    ? t("admin_plans.unlimited", "Unlimited")
    : t("admin_plans.stories_per_month", "{{count}} stories/month", { count: limit });

  const overLimitMsg = unlimited
    ? t("admin_plans.no_cap", "No cap.")
    : limit <= 1
    ? t("admin_plans.after_the_free_trial_generate_buttons_ar", "After the free trial: generate buttons are hidden and a Premium badge linking to /pricing is shown.")
    : t("admin_plans.when_over_limit_generation_is_blocked_an", "When over limit: generation is blocked and a toast prompts an upgrade with a button to /pricing.");

  const Row = ({ on, label }: { on: boolean; label: string }) => (
    <div className={`flex items-center justify-between text-xs rounded-lg px-2 py-1 ${on ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
      <span>{label}</span>
      <span className="font-bold">{on ? "✓" : "✕"}</span>
    </div>
  );

  return (
    <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-3 space-y-2">
      <div className="text-xs font-bold text-primary">
        {t("admin_plans.permissions_summary_preview", "Permissions Summary (Preview)")}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Row on={true} label={t("admin_plans.create_story", "Create story")} />
        <Row on={plan.allow_illustrations} label={t("admin_plans.illustrations_2", "Illustrations")} />
        <Row on={plan.allow_pdf} label="PDF" />
        <Row on={plan.allow_audio} label={t("admin_plans.audio", "Audio")} />
      </div>
      <div className="text-[11px] flex items-center justify-between border-t border-primary/20 pt-2">
        <span className="text-muted-foreground">{t("admin_plans.monthly_limit", "Monthly limit:")}</span>
        <span className="font-bold">{limitText}</span>
      </div>
      <p className="text-[11px] text-muted-foreground leading-relaxed">{overLimitMsg}</p>
    </div>
  );
}

function FeatureToggle({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2 text-sm font-medium">
        {icon}
        {label}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
