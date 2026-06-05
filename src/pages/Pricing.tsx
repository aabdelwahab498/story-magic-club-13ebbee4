import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";

import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Crown, Sparkles, Star, AlertCircle, RotateCw, CreditCard, Smartphone, Wallet, Building2, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchPlans, fetchPaymentSettings, type PlanTier, type PaymentMethod, type PayCurrency } from "@/lib/subscriptionApi";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { usePaddle } from "@/hooks/usePaddle";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type SelectableMethod = "paddle" | PaymentMethod;



const Pricing = () => {
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { tier: currentTier } = useSubscription();
  const { config: paddleConfig, ready: paddleReady, error: paddleError, openCheckout, reload: reloadPaddle } = usePaddle();
  const queryClient = useQueryClient();

  const q = useQuery({ queryKey: ["plans"], queryFn: fetchPlans });
  const autoTriggered = useRef(false);
  const successHandled = useRef(false);
  const [openingTier, setOpeningTier] = useState<PlanTier | null>(null);
  const [pollingSuccess, setPollingSuccess] = useState(false);
  const [showPaddleError, setShowPaddleError] = useState(false);


  const settingsQ = useQuery({ queryKey: ["payment-settings"], queryFn: fetchPaymentSettings });
  const [confirmTier, setConfirmTier] = useState<PlanTier | null>(null);
  const [chosenMethod, setChosenMethod] = useState<SelectableMethod | null>(null);

  const priceIdFor = (tier: string): string | null => {
    const p = paddleConfig?.plans.find((x) => x.tier === tier);
    return p?.paddle_price_id ?? null;
  };

  const confirmPlan = useMemo(
    () => q.data?.find((p) => p.tier === confirmTier) ?? null,
    [q.data, confirmTier],
  );

  // Build available methods for the dialog based on payment_settings
  const availableMethods = useMemo(() => {
    const s = settingsQ.data;
    const list: { id: SelectableMethod; label: string; sub: string; icon: typeof CreditCard; price: number; currency: string }[] = [];
    if (!confirmPlan) return list;
    if (priceIdFor(confirmPlan.tier)) {
      list.push({
        id: "paddle",
        label: isAr ? "بطاقة بنكية (USD) عبر Paddle" : "Credit card (USD) via Paddle",
        sub: isAr ? "تفعيل فوري بعد الدفع" : "Instant activation after payment",
        icon: CreditCard,
        price: confirmPlan.price_usd,
        currency: "USD",
      });
    }
    if (s) {
      const local: { id: PaymentMethod; label: string; icon: typeof CreditCard; enabled: boolean; currencies: PayCurrency[] }[] = [
        { id: "instapay", label: "InstaPay", icon: Smartphone, enabled: s.instapay_enabled && !!s.instapay_handle, currencies: s.instapay_currencies as PayCurrency[] },
        { id: "vodafone_cash", label: isAr ? "فودافون كاش" : "Vodafone Cash", icon: Wallet, enabled: s.vodafone_enabled && !!s.vodafone_number, currencies: s.vodafone_currencies as PayCurrency[] },
        { id: "payoneer", label: "Payoneer", icon: Globe, enabled: s.payoneer_enabled && !!s.payoneer_email, currencies: s.payoneer_currencies as PayCurrency[] },
        { id: "bank_transfer", label: isAr ? "تحويل بنكي" : "Bank Transfer", icon: Building2, enabled: s.bank_enabled && !!(s.bank_account_number || s.bank_iban), currencies: s.bank_currencies as PayCurrency[] },
      ];
      for (const m of local) {
        if (!m.enabled) continue;
        const cur = (m.currencies?.[0] ?? "EGP") as string;
        const price = cur === "USD" ? confirmPlan.price_usd : confirmPlan.price_egp;
        list.push({
          id: m.id,
          label: m.label,
          sub: isAr ? "يتم التفعيل بعد المراجعة" : "Activated after review",
          icon: m.icon,
          price,
          currency: cur,
        });
      }
    }
    return list;
  }, [settingsQ.data, confirmPlan, paddleConfig, isAr]);

  const openConfirm = (tier: PlanTier) => {
    if (tier === "free") return;
    if (!user) {
      const params = searchParams.toString();
      navigate(`/auth?redirect=${encodeURIComponent("/pricing" + (params ? `?${params}` : ""))}`);
      return;
    }
    setConfirmTier(tier);
    setChosenMethod(null);
  };


  const startPaddle = (tier: PlanTier) => {
    const priceId = priceIdFor(tier);
    if (!priceId) {
      toast.error(t("page_pricing.plan_not_configured", "This plan is not configured for checkout yet."));
      return;
    }
    if (paddleError) {
      setShowPaddleError(true);
      return;
    }
    if (!paddleReady) {
      toast.error(t("page_pricing.checkout_not_ready", "Payments are still loading. Please try again in a moment."));
      return;
    }
    try {
      setOpeningTier(tier);
      openCheckout({
        priceId,
        email: user?.email ?? undefined,
        userId: user!.id,
        tier,
        successPath: "/pricing?paddle=success",
      });
      setTimeout(() => setOpeningTier(null), 4000);
    } catch (e: any) {
      setOpeningTier(null);
      setShowPaddleError(true);
      toast.error(
        isAr
          ? `تعذّر فتح نافذة الدفع: ${e?.message ?? "خطأ غير معروف"}`
          : `Could not open checkout: ${e?.message ?? "unknown error"}`,
      );
    }
  };

  const handleConfirm = () => {
    if (!confirmTier || !chosenMethod) return;
    const tier = confirmTier;
    const method = chosenMethod;
    setConfirmTier(null);
    if (method === "paddle") {
      startPaddle(tier);
    } else {
      navigate(`/checkout/manual?plan=${tier}&method=${method}`);
    }
  };


  // NOTE: We intentionally do NOT auto-open Paddle when arriving with ?subscribe=<tier>.
  // The customer should pick their payment method (card via Paddle, or local methods)
  // themselves from the plan card. We just clean the param so it doesn't linger.
  useEffect(() => {
    if (autoTriggered.current) return;
    if (!searchParams.get("subscribe")) return;
    autoTriggered.current = true;
    const next = new URLSearchParams(searchParams);
    next.delete("subscribe");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle return from Paddle. Webhook unlocks features asynchronously,
  // so we poll the subscription until tier flips off "free".
  useEffect(() => {
    if (successHandled.current) return;
    const paddleResult = searchParams.get("paddle");
    if (!paddleResult) return;
    successHandled.current = true;

    const next = new URLSearchParams(searchParams);
    next.delete("paddle");
    setSearchParams(next, { replace: true });

    if (paddleResult === "cancelled" || paddleResult === "canceled") {
      toast.warning(
        isAr ? "تم إلغاء الدفع. يمكنك المحاولة مرة أخرى." : "Payment cancelled. You can try again.",
      );
      return;
    }
    if (paddleResult !== "success") return;

    toast.success(
      isAr
        ? "تم استلام الدفع! جارٍ تفعيل ميزات حسابك..."
        : "Payment received! Activating your features...",
    );
    setPollingSuccess(true);
    let attempts = 0;
    const maxAttempts = 12;
    const tick = async () => {
      attempts += 1;
      await queryClient.invalidateQueries({ queryKey: ["active-sub"] });
      await queryClient.invalidateQueries({ queryKey: ["subscription-plans"] });
      const fresh = queryClient.getQueryData<any>(["active-sub", user?.id]);
      const tier = fresh?.plan_tier;
      if (tier && tier !== "free") {
        setPollingSuccess(false);
        toast.success(
          isAr ? "تم تفعيل ميزات الصور والصوت ✨" : "Images & audio features unlocked ✨",
        );
        // If the user came here from /stories with a pending idea, resume generation.
        try {
          const raw = localStorage.getItem("pending-story-idea");
          if (raw) {
            navigate("/ai-storyteller");
          }
        } catch { /* ignore */ }
        return;
      }
      if (attempts >= maxAttempts) {
        setPollingSuccess(false);
        toast.info(
          isAr
            ? "الدفع قيد المعالجة. الميزات هتتفعّل خلال دقيقة."
            : "Payment is being processed. Features will unlock within a minute.",
        );
        return;
      }
      setTimeout(tick, 2000);
    };
    tick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);




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

      {paddleError && showPaddleError && (
        <div className="max-w-xl mx-auto mb-6 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-900 dark:text-amber-200">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold mb-1">
              {paddleError === "paddle_not_configured"
                ? t("page_pricing.payments_setup_in_progress", "Payments are being set up. Please check back soon.")
                : isAr
                  ? "تعذّر تحميل نظام الدفع."
                  : "Could not load the payment system."}
            </p>
            <p className="text-xs opacity-80 break-all">{paddleError}</p>
          </div>
          {paddleError !== "paddle_not_configured" && (
            <button
              onClick={() => {
                autoTriggered.current = false;
                reloadPaddle();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500 text-white font-bold text-xs hover:bg-amber-600 transition"
            >
              <RotateCw className="h-3.5 w-3.5" />
              {isAr ? "إعادة المحاولة" : "Retry"}
            </button>
          )}
        </div>
      )}

      {pollingSuccess && (
        <div className="max-w-xl mx-auto mb-6 flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 p-4 text-sm text-emerald-900 dark:text-emerald-100">
          <Loader2 className="h-5 w-5 animate-spin shrink-0" />
          <span className="font-semibold">
            {isAr
              ? "جارٍ تفعيل اشتراكك وفكّ قفل الصور والصوت..."
              : "Activating your subscription and unlocking images & audio..."}
          </span>
        </div>
      )}

      {openingTier && !paddleError && (
        <div className="max-w-xl mx-auto mb-6 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 text-sm">
          <Loader2 className="h-5 w-5 animate-spin shrink-0 text-primary" />
          <span className="font-semibold">
            {isAr ? "جارٍ فتح نافذة الدفع..." : "Opening secure checkout..."}
          </span>
        </div>
      )}

      {q.isLoading && (
        <div className="text-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
        </div>
      )}


      <div className="flex flex-wrap justify-center gap-5 max-w-5xl mx-auto [&>*]:w-full md:[&>*]:w-[calc(33.333%-0.834rem)] [&>*]:max-w-sm">
        {(() => {
          const list = q.data ?? [];
          const paid = list.filter((p) => (p.price_usd ?? 0) > 0);
          const explicitlyFeatured = paid.find((p) => p.is_featured);
          const popularId = explicitlyFeatured
            ? explicitlyFeatured.id
            : paid.length
            ? paid.reduce((a, b) => ((b.price_usd ?? 0) > (a.price_usd ?? 0) ? b : a)).id
            : null;
          return list.map((plan) => {
          const isCurrent = currentTier === plan.tier;
          const isPremium = plan.id === popularId;
          const isFree = (plan.price_usd ?? 0) <= 0;
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
                onClick={() => openConfirm(plan.tier)}
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
              {!isFree && !isCurrent && (
                <p className="mt-2 text-[11px] text-center text-muted-foreground">
                  {isAr
                    ? "اختر وسيلة الدفع في الخطوة التالية"
                    : "Choose your payment method in the next step"}
                </p>
              )}

            </article>
          );
        });
        })()}
      </div>


      <p className="text-center text-xs text-muted-foreground max-w-xl mx-auto mt-8">
        {t(
          "page_pricing.paddle_footer",
          "Payments are processed securely by Paddle. Cancel or manage your subscription anytime from your account.",
        )}
      </p>

      <Dialog open={!!confirmTier} onOpenChange={(o) => !o && setConfirmTier(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isAr ? "تأكيد الاشتراك" : "Confirm subscription"}
            </DialogTitle>
            <DialogDescription>
              {confirmPlan && (
                <>
                  {isAr ? "خطة" : "Plan"}: <b>{confirmPlan.name[isAr ? "ar" : "en"]}</b>
                  {" · "}
                  {isAr ? "اختر وسيلة الدفع لإكمال العملية." : "Choose a payment method to continue."}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-[55vh] overflow-y-auto">
            {availableMethods.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {isAr ? "لا توجد وسائل دفع متاحة حالياً." : "No payment methods available."}
              </p>
            )}
            {availableMethods.map((m) => {
              const Icon = m.icon;
              const selected = chosenMethod === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setChosenMethod(m.id)}
                  className={cn(
                    "w-full text-start flex items-center gap-3 p-3 rounded-2xl border-2 transition",
                    selected
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:border-primary/40",
                  )}
                >
                  <div className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                    selected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                  )}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{m.label}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{m.sub}</p>
                  </div>
                  <div className="text-end">
                    <p className="font-extrabold text-primary text-sm whitespace-nowrap">
                      {m.currency === "USD" ? "$" : ""}{m.price}{m.currency !== "USD" ? ` ${m.currency}` : ""}
                    </p>
                    <p className="text-[10px] text-muted-foreground">/ {isAr ? "شهر" : "mo"}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {chosenMethod === "paddle" && paddleError && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold">
                  {isAr ? "تعذّر تشغيل الدفع بالبطاقة." : "Card payment is unavailable right now."}
                </p>
                <p className="opacity-80 break-all">{paddleError}</p>
              </div>
              <button
                onClick={() => reloadPaddle()}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500 text-white font-bold text-[11px]"
              >
                <RotateCw className="h-3 w-3" />
                {isAr ? "إعادة" : "Retry"}
              </button>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <button
              onClick={() => setConfirmTier(null)}
              className="flex-1 px-4 py-2.5 rounded-full font-bold text-sm border-2 border-muted hover:bg-muted/40"
            >
              {isAr ? "إلغاء" : "Cancel"}
            </button>
            <button
              onClick={handleConfirm}
              disabled={!chosenMethod || (chosenMethod === "paddle" && (!paddleReady || !!paddleError))}
              className="flex-1 px-4 py-2.5 rounded-full font-bold text-sm bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAr ? "تأكيد ومتابعة" : "Confirm & continue"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

};

export default Pricing;
