import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Crown, Check, Sparkles, KeyRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fetchPlans, type SubscriptionPlan } from "@/lib/subscriptionApi";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional context line shown above the plans (e.g. "You've used all 5 monthly stories"). */
  reason?: string;
}

/**
 * Surfaced when a free/paid user hits their monthly story cap.
 * Lists available plans and offers a BYOK shortcut for Pro/Elite tiers.
 */
const UpgradeModal = ({ open, onOpenChange, reason }: UpgradeModalProps) => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");

  const { data: plans } = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: fetchPlans,
    staleTime: 5 * 60_000,
    enabled: open,
  });

  const upgradable = (plans ?? [])
    .filter((p) => p.tier !== "free")
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Crown className="h-5 w-5 text-amber-500" />
            {t("upgrade_modal.title", "You've reached your monthly story limit")}
          </DialogTitle>
          <DialogDescription>
            {reason ??
              t(
                "upgrade_modal.subtitle",
                "Upgrade your plan to keep creating magical stories — or bring your own API key on Pro Creator / Elite Publisher to generate without limits.",
              )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2 mt-2">
          {upgradable.length === 0 ? (
            <div className="col-span-full text-sm text-muted-foreground text-center py-6">
              {t("upgrade_modal.loading_plans", "Loading plans…")}
            </div>
          ) : (
            upgradable.map((p: SubscriptionPlan) => (
              <div
                key={p.id}
                className="rounded-xl border border-foreground/10 p-4 bg-white/60 dark:bg-white/5 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-bold capitalize flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-primary" />
                    {p.name?.[isAr ? "ar" : "en"] ?? p.tier}
                  </h3>
                  <span className="text-sm font-bold text-primary">
                    ${p.price_usd}/mo
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("upgrade_modal.monthly_limit", "{{count}} stories / month", {
                    count: p.monthly_story_limit ?? 0,
                  })}
                </p>
                <ul className="text-xs space-y-1 mt-1">
                  {p.allow_illustrations && (
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-emerald-500" />
                      {t("upgrade_modal.illustrations", "AI illustrations")}
                    </li>
                  )}
                  {p.allow_audio && (
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-emerald-500" />
                      {t("upgrade_modal.audio", "HD narration")}
                    </li>
                  )}
                  {p.allow_pdf && (
                    <li className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-emerald-500" />
                      {t("upgrade_modal.pdf", "PDF export")}
                    </li>
                  )}
                  {(String(p.tier) === "pro_creator" || String(p.tier) === "elite_publisher") && (
                    <li className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                      <KeyRound className="h-3 w-3" />
                      {t("upgrade_modal.byok", "Bring your own API key (unlimited)")}
                    </li>
                  )}
                </ul>
              </div>
            ))
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-3 mt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="sm:order-1">
            {t("upgrade_modal.maybe_later", "Maybe later")}
          </Button>
          <Button asChild className="sm:order-2">
            <Link to="/pricing" onClick={() => onOpenChange(false)}>
              {t("upgrade_modal.view_plans", "View all plans")}
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradeModal;
