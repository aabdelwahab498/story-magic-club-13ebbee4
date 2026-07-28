import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CreditCard, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

type PaddleSub = {
  tier: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

export default function PaddleSubscriptionCard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [sub, setSub] = useState<PaddleSub | null>(null);
  const [loading, setLoading] = useState(true);
  const [opening] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("paddle_subscriptions")
        .select("tier, status, current_period_end, cancel_at_period_end")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setSub(data as PaddleSub | null);
      setLoading(false);
    })();
  }, [user]);

  const openPortal = async () => {
    toast.error("Paddle billing portal is not yet migrated to Backend Core");
  };

  if (loading) {
    return (
      <Card className="p-5 sm:p-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  return (
    <Card className="p-5 sm:p-6 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          {t("profile.subscription", "Subscription")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {sub
            ? t(
                "profile.subscription_active_desc",
                "Manage billing, change plan, or cancel anytime via Paddle.",
              )
            : t(
                "profile.subscription_none_desc",
                "You don't have an active paid subscription yet.",
              )}
        </p>
      </div>

      {sub && (
        <div className="rounded-lg border border-border p-4 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">
              {t("profile.current_plan", "Current plan")}
            </span>
            <Badge variant="secondary" className="capitalize">{sub.tier}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{t("profile.status", "Status")}</span>
            <Badge
              variant={sub.status === "active" ? "default" : "outline"}
              className="capitalize"
            >
              {sub.status}
            </Badge>
          </div>
          {sub.current_period_end && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {sub.cancel_at_period_end
                  ? t("profile.ends_on", "Ends on")
                  : t("profile.renews_on", "Renews on")}
              </span>
              <span className="font-medium">
                {new Date(sub.current_period_end).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        {sub ? (
          <Button onClick={openPortal} disabled={opening} className="gap-2">
            {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
            {t("profile.manage_subscription", "Manage subscription")}
          </Button>
        ) : (
          <Button asChild>
            <a href="/pricing">{t("profile.view_plans", "View plans")}</a>
          </Button>
        )}
      </div>
    </Card>
  );
}
