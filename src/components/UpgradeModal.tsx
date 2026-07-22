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
import { useAuth } from "@/hooks/useAuth";

interface PlanAPI {
  id: string;
  name: Record<string, string>;
  slug: string;
  description: Record<string, string>;
  price_usd: number;
  price_egp: number;
  is_featured: boolean;
  features: string[];
  limits: Record<string, number | null>;
}

const fetchBackendPlans = async (token?: string): Promise<PlanAPI[]> => {
  const headers: HeadersInit = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/v2/subscriptions/plans`, { headers });
  if (!res.ok) throw new Error("Failed to fetch plans");
  return res.json();
};

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional context line shown above the plans (e.g. "You've used all 5 monthly stories"). */
  reason?: string;
}

/**
 * Surfaced when a free/paid user hits their monthly limit.
 * Lists available plans and offers a BYOK shortcut for Pro/Elite tiers.
 */
const UpgradeModal = ({ open, onOpenChange, reason }: UpgradeModalProps) => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  const { session } = useAuth();

  const { data: plans } = useQuery({
    queryKey: ["backend-plans", session?.access_token],
    queryFn: () => fetchBackendPlans(session?.access_token),
    staleTime: 5 * 60_000,
    enabled: open,
  });

  const upgradable = (plans ?? [])
    .filter((p) => p.price_usd > 0)
    .sort((a, b) => a.price_usd - b.price_usd);

  const featureLabels: Record<string, { ar: string; en: string }> = {
    "STORY_GENERATION": { ar: "توليد القصص", en: "Story Generation" },
    "ILLUSTRATION_GENERATION": { ar: "رسم شخصيات", en: "AI Illustrations" },
    "PDF_EXPORT": { ar: "تصدير PDF", en: "PDF Export" },
    "AUDIO_NARRATION": { ar: "نطق صوتي", en: "HD Narration" }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Crown className="h-5 w-5 text-amber-500" />
            {t("upgrade_modal.title", "You've reached your monthly limit")}
          </DialogTitle>
          <DialogDescription>
            {reason ??
              t(
                "upgrade_modal.subtitle",
                "Upgrade your plan to keep creating magical stories — or bring your own API key to generate without limits.",
              )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2 mt-2">
          {upgradable.length === 0 ? (
            <div className="col-span-full text-sm text-muted-foreground text-center py-6">
              {t("upgrade_modal.loading_plans", "Loading plans…")}
            </div>
          ) : (
            upgradable.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-foreground/10 p-4 bg-white/60 dark:bg-white/5 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-bold capitalize flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-primary" />
                    {p.name?.[isAr ? "ar" : "en"] ?? p.slug}
                  </h3>
                  <span className="text-sm font-bold text-primary">
                    ${p.price_usd}/mo
                  </span>
                </div>
                {p.limits && p.limits['STORIES_PER_MONTH'] !== undefined && (
                  <p className="text-xs text-muted-foreground">
                    {p.limits['STORIES_PER_MONTH'] === null 
                      ? t("page_pricing.unlimited_stories", "Unlimited stories") 
                      : t("upgrade_modal.monthly_limit", "{{count}} stories / month", {
                          count: p.limits['STORIES_PER_MONTH'] ?? 0,
                        })
                    }
                  </p>
                )}
                
                <ul className="text-xs space-y-1 mt-1">
                  {p.features.map(f => (
                    <li key={f} className="flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-emerald-500" />
                      {featureLabels[f]?.[isAr ? "ar" : "en"] || f}
                    </li>
                  ))}
                  {(p.slug === "PRO_CREATOR" || p.slug === "ELITE_PUBLISHER") && (
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
