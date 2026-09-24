import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Check, Loader2, Crown, Sparkles, Star, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";

import { usePlans } from "@/lib/plansApi";

const Pricing = () => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  const navigate = useNavigate();
  const { user } = useAuth();
  const { plan: currentPlanSlug } = useSubscription();

  const q = usePlans();

  /**
   * Sends the customer to the reviewed-transfer checkout, which is the payment
   * flow that actually works today (InstaPay / Vodafone Cash / Payoneer /
   * bank transfer with proof upload and admin approval).
   */
  const handleUpgradeClick = (planTier: string) => {
    const target = `/checkout/manual?plan=${planTier}`;
    if (!user) {
      navigate(`/auth?redirect=${encodeURIComponent(target)}`);
      return;
    }
    navigate(target);
  };

  const featureLabels: Record<string, { ar: string; en: string }> = {
    "STORY_GENERATION": { ar: "توليد القصص بالذكاء الاصطناعي", en: "AI Story Generation" },
    "ILLUSTRATION_GENERATION": { ar: "رسم شخصيات ومشاهد", en: "Character & Scene Illustrations" },
    "PDF_EXPORT": { ar: "تصدير القصة ككتاب PDF", en: "Export as PDF Book" },
    "REGENERATE_ILLUSTRATION": { ar: "إعادة رسم الصفحات", en: "Regenerate Pages" },
    "AUDIO_NARRATION": { ar: "رواية صوتية للقصة", en: "Audio Narration" }
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
          {isAr ? "اكتشف عالم القصص مع باقات نَجْمَة التي تناسب احتياجات طفلك." : "Discover the world of stories with Najmah plans tailored for your child."}
        </p>
      </header>

      {q.isLoading && (
        <div className="text-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
        </div>
      )}

      {q.error && (
        <div className="text-center py-10 text-red-500">
          Failed to load plans.
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-5 max-w-5xl mx-auto [&>*]:w-full md:[&>*]:w-[calc(50%-0.625rem)] lg:[&>*]:w-[calc(33.333%-0.834rem)] [&>*]:max-w-sm">
        {(() => {
          const list = q.data ?? [];
          return list.map((plan) => {
            const isCurrent = String(currentPlanSlug) === plan.slug;
            const isPremium = plan.is_featured || plan.price_usd > 0;
            const isFree = plan.price_usd <= 0;
            const price = plan.price_usd;

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
                    {plan.name[isAr ? "ar" : "en"] || plan.slug}
                  </h2>
                </div>
                <p className="text-sm text-muted-foreground mb-4 min-h-[1.5rem]">
                  {plan.description?.[isAr ? "ar" : "en"]}
                </p>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="text-2xl font-bold text-primary">$</span>
                  <span className="text-5xl font-extrabold text-primary">{price}</span>
                  <span className="text-muted-foreground text-sm ms-1">
                    / {t("page_pricing.mo", "mo")}
                  </span>
                </div>

                <ul className="space-y-2 mb-5">
                  {/* limits display */}
                  {plan.limits && Object.entries(plan.limits).map(([key, value]) => {
                    if (key === 'STORIES_PER_MONTH') {
                      return (
                        <li key={key} className="flex items-start gap-2 text-sm font-bold">
                          <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                          <span>
                            {value === null 
                              ? t("page_pricing.unlimited_stories", "Unlimited stories") 
                              : isAr ? `${value} قصة شهرياً` : `${value} stories/month`}
                          </span>
                        </li>
                      );
                    }
                    if (key === 'ILLUSTRATIONS_PER_MONTH' && value !== null && value > 0) {
                      return (
                        <li key={key} className="flex items-start gap-2 text-sm">
                          <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                          <span>
                             {isAr ? `${value} رسمة توضيحية شهرياً` : `${value} illustrations/month`}
                          </span>
                        </li>
                      );
                    }
                    return null;
                  })}

                  {/* features display */}
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span>{featureLabels[f]?.[isAr ? "ar" : "en"] || f}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleUpgradeClick(plan.slug)}
                  disabled={isCurrent || isFree}
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
                    : isAr
                    ? "اشترك الآن"
                    : t("page_pricing.subscribe_now", "Subscribe now")}
                </button>
              </article>
            );
          });
        })()}
      </div>

      <p className="mt-8 max-w-2xl mx-auto text-center text-sm text-muted-foreground flex items-start justify-center gap-2">
        <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
        <span>
          {isAr
            ? "الدفع حاليًا يتم عبر إنستاباي أو فودافون كاش أو باي أونير أو تحويل بنكي: ترفع إثبات الدفع ويُفعّل اشتراكك بعد المراجعة."
            : t(
                "page_pricing.manual_payment_note",
                "Payments are handled via InstaPay, Vodafone Cash, Payoneer or bank transfer: upload your payment proof and your plan is activated after review.",
              )}
        </span>
      </p>
    </div>
  );
};

export default Pricing;
