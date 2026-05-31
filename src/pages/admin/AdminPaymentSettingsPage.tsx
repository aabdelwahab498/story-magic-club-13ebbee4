import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Loader2, CheckCircle2, AlertCircle, ExternalLink, CreditCard, RefreshCw, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type PaddleConfig = {
  clientToken: string;
  environment: "sandbox" | "production";
  configured: boolean;
  plans: Array<{
    tier: string;
    paddle_price_id: string | null;
    paddle_product_id: string | null;
    price_usd: number;
    name: Record<string, string>;
  }>;
};

const AdminPaymentSettingsPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<PaddleConfig | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<PaddleConfig>("paddle-config", {
        method: "GET",
      });
      if (error) throw error;
      setConfig(data ?? null);
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Failed to load Paddle config",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const syncProducts = async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke("paddle-seed-products", { method: "POST" });
      if (error) throw error;
      toast({ title: t("admin_payment_settings.synced", "Synced with Paddle") });
      await load();
    } catch (e) {
      toast({
        title: "Sync failed",
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const configured = !!config?.configured;
  const linkedPlans = (config?.plans ?? []).filter((p) => p.paddle_price_id).length;
  const totalPlans = config?.plans?.length ?? 0;

  return (
    <div className="max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-primary" />
          {t("admin_payment_settings.title_paddle", "Payments — Paddle")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "admin_payment_settings.subtitle_paddle",
            "All paid subscriptions are processed by Paddle in USD. Parents check out securely from the pricing page.",
          )}
        </p>
      </header>

      {/* Status */}
      <div
        className={`rounded-2xl p-5 border-2 ${
          configured
            ? "border-emerald-300/60 bg-emerald-50/60 dark:bg-emerald-950/20"
            : "border-amber-300/60 bg-amber-50/60 dark:bg-amber-950/20"
        }`}
      >
        <div className="flex items-start gap-3">
          {configured ? (
            <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          ) : (
            <AlertCircle className="h-6 w-6 text-amber-600 dark:text-amber-400 mt-0.5" />
          )}
          <div className="flex-1">
            <h3 className="font-extrabold">
              {configured
                ? t("admin_payment_settings.paddle_connected", "Paddle is connected")
                : t("admin_payment_settings.paddle_not_configured", "Paddle is not configured")}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {configured
                ? t(
                    "admin_payment_settings.paddle_env_info",
                    "Environment: {{env}}. Webhooks and checkout are live.",
                    { env: config?.environment ?? "sandbox" },
                  )
                : t(
                    "admin_payment_settings.paddle_missing_keys",
                    "Add PADDLE_API_KEY, PADDLE_CLIENT_TOKEN, PADDLE_ENVIRONMENT and PADDLE_WEBHOOK_SECRET in backend secrets.",
                  )}
            </p>
          </div>
        </div>
      </div>

      {/* Plan link status */}
      <div className="rounded-2xl p-5 border-2 border-muted bg-white dark:bg-card space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-extrabold flex items-center gap-2">
              <Crown className="h-4 w-4 text-primary" />
              {t("admin_payment_settings.plan_sync", "Plan ↔ Paddle sync")}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {t(
                "admin_payment_settings.plan_sync_desc",
                "{{linked}} of {{total}} plans linked to a Paddle price.",
                { linked: linkedPlans, total: totalPlans },
              )}
            </p>
          </div>
          <button
            onClick={syncProducts}
            disabled={syncing || !configured}
            className="px-4 py-2 rounded-full bg-primary text-primary-foreground font-bold text-sm inline-flex items-center gap-2 disabled:opacity-50"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {t("admin_payment_settings.sync_paddle", "Sync products")}
          </button>
        </div>

        {totalPlans > 0 && (
          <div className="space-y-2">
            {config!.plans.map((p) => (
              <div
                key={p.tier}
                className="flex items-center justify-between rounded-lg border border-muted p-3 text-sm"
              >
                <div>
                  <div className="font-bold">{p.name?.en ?? p.tier}</div>
                  <div className="text-xs text-muted-foreground">
                    ${p.price_usd} USD · {p.tier}
                  </div>
                </div>
                <div className="text-xs">
                  {p.paddle_price_id ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Linked
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
                      <AlertCircle className="h-3.5 w-3.5" /> Not linked
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <Link
          to="/admin/dashboard/plans"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
        >
          {t("admin_payment_settings.manage_plans", "Manage subscription plans")}
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Help */}
      <div className="rounded-2xl p-5 border-2 border-muted bg-muted/20 space-y-2 text-sm">
        <h3 className="font-extrabold">
          {t("admin_payment_settings.setup_checklist", "Setup checklist")}
        </h3>
        <ol className="list-decimal ms-5 space-y-1 text-muted-foreground">
          <li>{t("admin_payment_settings.step_secrets", "Add Paddle secrets in backend settings.")}</li>
          <li>
            {t(
              "admin_payment_settings.step_webhook",
              "In Paddle dashboard, set webhook URL to the paddle-webhook function and copy the signing secret.",
            )}
          </li>
          <li>
            {t(
              "admin_payment_settings.step_domain",
              "Add your site domain to Paddle approved domains for checkout.",
            )}
          </li>
          <li>{t("admin_payment_settings.step_sync", "Click Sync products to create/link prices.")}</li>
        </ol>
      </div>
    </div>
  );
};

export default AdminPaymentSettingsPage;
