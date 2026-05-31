import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, Crown, Sparkles, Star, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchPlans, type PlanTier } from "@/lib/subscriptionApi";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { usePaddle } from "@/hooks/usePaddle";
import { toast } from "sonner";

const Pricing = () => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tier: currentTier } = useSubscription();
  const { config: paddleConfig, ready: paddleReady, error: paddleError, openCheckout } = usePaddle();

  const q = useQuery({ queryKey: ["plans"], queryFn: fetchPlans });

  const priceIdFor = (tier: string): string | null => {
    const p = paddleConfig?.plans.find((x) => x.tier === tier);
    return p?.paddle_price_id ?? null;
  };

  const subscribe = (tier: PlanTier) => {
    if (tier === "free") return;
    if (!user) {
      navigate(`/auth?redirect=/pricing`);
      return;
    }

    const priceId = priceIdFor(tier);
    if (!priceId) {
      toast.error(
        t("page_pricing.plan_not_configured", "This plan is not configured for checkout yet."),
      );
      return;
    }
    if (!paddleReady) {
      toast.error(
        t("page_pricing.checkout_not_ready", "Payments are still loading. Please try again in a moment."),
      );
      return;
    }
    try {
      openCheckout({ priceId, email: user.email ?? undefined, userId: user.id, tier });
    } catch (e: any) {
      toast.error(e?.message ?? "checkout_failed");
    }
  };

  return (
    <div className="py-4 sm:py-6">
      <header className="text-center mb-8 animate-fade-in">
        <span className="inline-block px-4 py-1.5 rounded-full bg-kids-softPurple text-primary text-sm font-bold mb-3">
          💰 {t("page_pricing.choose_your_plan", "Choose your plan")}
        </span>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground mb-3">
          {t("page_pricing.simple_fair_pricing", "Simple, fair pricing")}
        </h1>
        <p className="text-base text-muted-foreground max-w-2xl mx-auto">
          {t(
            "page_pricing.pay_in_usd_via_paddle",
            "Pay securely in USD via Paddle. Cancel anytime.",
          )}
        </p>
      </header>

      {paddleError && (
        <div className="max-w-xl mx-auto mb-6 flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-900 dark:text-amber-200">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            {paddleError === "paddle_not_configured"
              ? t("page_pricing.payments_setup_in_progress", "Payments are being set up. Please check back soon.")
              : t("page_pricing.checkout_unavailable", "Checkout is temporarily unavailable.")}
          </div>
        </div>
      )}

      {q.isLoading && (
        <div className="text-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
        {q.data?.map((plan) => {
          const isCurrent = currentTier === plan.tier;
          const isPremium = plan.tier === "premium";
          const isFree = plan.tier === "free";
          const price = plan.price_usd;
          const hasPriceId = Boolean(priceIdFor(plan.tier));

          return (
            <article
              key={plan.id}
              className={cn(
                "relative rounded-3xl p-6 border-2 shadow-soft hover-pop transition-all",
                isPremium
                  ? "bg-gradient-to-br from-kids-softYellow via-white to-kids-softPurple/40 dark:from-card/90 dark:via-card/80 dark:to-card/70 border-sunset shadow-glow"
                  : "bg-white/95 dark:bg-card/90 border-white/60",
              )}
            >
              {isPremium && (
                <span className="absolute -top-3 start-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-sunset text-kids-midnight text-xs font-bold shadow-soft whitespace-nowrap">
                  ⭐ {t("page_pricing.most_popular", "Most popular")}
                </span>
              )}
              <div className="flex items-center gap-2 mb-2">
                {isPremium ? (
                  <Crown className="h-6 w-6 text-amber-500" />
                ) : isFree ? (
                  <Sparkles className="h-6 w-6 text-primary" />
                ) : (
                  <Star className="h-6 w-6 text-primary" />
                )}
                <h2 className="text-2xl font-extrabold">
                  {plan.name[isAr ? "ar" : "en"]}
                </h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4 min-h-[1.5rem]">
                {plan.description[isAr ? "ar" : "en"]}
              </p>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-2xl font-bold text-primary">$</span>
                <span className="text-5xl font-extrabold text-primary">{price}</span>
                <span className="text-muted-foreground text-sm ms-1">
                  / {t("page_pricing.mo", "mo")}
                </span>
              </div>

              <ul className="space-y-2 mb-5">
                <li className="flex items-start gap-2 text-sm">
                  <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span>
                    {plan.monthly_story_limit >= 999
                      ? t("page_pricing.unlimited_stories", "Unlimited stories")
                      : isAr
                      ? `${plan.monthly_story_limit} قصة شهرياً`
                      : `${plan.monthly_story_limit} stories/month`}
                  </span>
                </li>
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <span>{f[isAr ? "ar" : "en"]}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => subscribe(plan.tier)}
                disabled={isCurrent || isFree || (!isFree && !hasPriceId)}
                title={!isFree && !hasPriceId ? "Not configured yet" : undefined}
                className={cn(
                  "w-full px-4 py-3 rounded-full font-bold hover-pop shadow-soft disabled:opacity-60 disabled:cursor-not-allowed",
                  isPremium
                    ? "bg-sunset text-kids-midnight"
                    : "bg-primary text-primary-foreground",
                )}
              >
                {isCurrent
                  ? t("page_pricing.current_plan", "Current plan")
                  : isFree
                  ? t("page_pricing.start_free", "Start free")
                  : !hasPriceId
                  ? t("page_pricing.coming_soon", "Coming soon")
                  : t("page_pricing.subscribe", "Subscribe")}
              </button>
            </article>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground max-w-xl mx-auto mt-8">
        {t(
          "page_pricing.paddle_footer",
          "Payments are processed securely by Paddle. Cancel or manage your subscription anytime from your account.",
        )}
      </p>
    </div>
  );
};

export default Pricing;
