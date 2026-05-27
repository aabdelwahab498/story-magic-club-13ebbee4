import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, Crown, Sparkles, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchPlans, type PlanTier, type Currency } from "@/lib/subscriptionApi";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useState } from "react";

const Pricing = () => {
  const { i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tier: currentTier } = useSubscription();
  const [currency, setCurrency] = useState<Currency>(isAr ? "EGP" : "USD");

  const q = useQuery({ queryKey: ["plans"], queryFn: fetchPlans });

  const subscribe = (tier: PlanTier) => {
    if (tier === "free") return;
    if (!user) {
      navigate(`/auth?redirect=/checkout/manual?plan=${tier}&currency=${currency}`);
      return;
    }
    navigate(`/checkout/manual?plan=${tier}&currency=${currency}`);
  };

  return (
    <div className="py-4 sm:py-6">
      <header className="text-center mb-8 animate-fade-in">
        <span className="inline-block px-4 py-1.5 rounded-full bg-kids-softPurple text-primary text-sm font-bold mb-3">
          💰 {isAr ? "اختر خطتك" : "Choose your plan"}
        </span>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground mb-3">
          {isAr ? "خطط بسيطة وعادلة" : "Simple, fair pricing"}
        </h1>
        <p className="text-base text-muted-foreground max-w-2xl mx-auto">
          {isAr
            ? "ادفع بالجنيه أو الدولار — InstaPay أو Vodafone Cash — مع إثبات يدوي."
            : "Pay in EGP or USD — InstaPay or Vodafone Cash — with manual proof."}
        </p>

        <div className="inline-flex items-center bg-white/90 dark:bg-card/80 rounded-full p-1 mt-5 border-2 border-white/60 shadow-soft">
          {(["EGP", "USD"] as Currency[]).map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className={cn(
                "px-5 py-2 rounded-full text-sm font-bold transition-all",
                currency === c
                  ? "bg-primary text-primary-foreground shadow-soft"
                  : "text-foreground hover:bg-accent/40",
              )}
            >
              {c === "EGP" ? "🇪🇬 EGP" : "🌍 USD"}
            </button>
          ))}
        </div>
      </header>

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
          const price = currency === "EGP" ? plan.price_egp : plan.price_usd;
          const symbol = currency === "EGP" ? "ج.م" : "$";

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
                  ⭐ {isAr ? "الأكثر طلباً" : "Most popular"}
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
                {currency === "USD" && <span className="text-2xl font-bold text-primary">{symbol}</span>}
                <span className="text-5xl font-extrabold text-primary">{price}</span>
                {currency === "EGP" && <span className="text-lg font-bold">{symbol}</span>}
                <span className="text-muted-foreground text-sm ms-1">/ {isAr ? "شهر" : "mo"}</span>
              </div>

              <ul className="space-y-2 mb-5">
                <li className="flex items-start gap-2 text-sm">
                  <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <span>
                    {plan.monthly_story_limit >= 999
                      ? isAr
                        ? "قصص غير محدودة"
                        : "Unlimited stories"
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
                disabled={isCurrent || isFree}
                className={cn(
                  "w-full px-4 py-3 rounded-full font-bold hover-pop shadow-soft disabled:opacity-60 disabled:cursor-not-allowed",
                  isPremium
                    ? "bg-sunset text-kids-midnight"
                    : "bg-primary text-primary-foreground",
                )}
              >
                {isCurrent
                  ? isAr
                    ? "خطتك الحالية"
                    : "Current plan"
                  : isFree
                  ? isAr
                    ? "ابدأ مجاناً"
                    : "Start free"
                  : isAr
                  ? "اشترك الآن"
                  : "Subscribe"}
              </button>
            </article>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground max-w-xl mx-auto mt-8">
        {isAr
          ? "بعد التحويل ارفع إثبات الدفع وسيتم تفعيل اشتراكك خلال 24 ساعة."
          : "After transferring, upload your proof — your subscription is activated within 24 hours."}
      </p>
    </div>
  );
};

export default Pricing;
