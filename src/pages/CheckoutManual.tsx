import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useQuery } from "@tanstack/react-query";
import {
  Smartphone,
  Wallet,
  Globe,
  Building2,
  Copy,
  UploadCloud,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  fetchPlans,
  fetchPaymentSettings,
  uploadPaymentProof,
  createPaymentRequest,
  type PaymentMethod,
  type PlanTier,
  type Currency,
  type PaymentSettings,
  type PayCurrency,
} from "@/lib/subscriptionApi";

interface MethodConfig {
  id: PaymentMethod;
  label: string;
  icon: typeof Smartphone;
  enabled: boolean;
  currencies: PayCurrency[];
  /** Receiver lines shown to the customer. */
  receiver: { label: string; value: string | null }[];
}

const buildMethods = (
  s: PaymentSettings,
  isAr: boolean,
  t: TFunction,
): MethodConfig[] => [
  {
    id: "instapay",
    label: t("page_checkout_manual.instapay", "InstaPay"),
    icon: Smartphone,
    enabled: s.instapay_enabled && !!s.instapay_handle,
    currencies: s.instapay_currencies as PayCurrency[],
    receiver: [{ label: t("page_checkout_manual.handle", "Handle"), value: s.instapay_handle }],
  },
  {
    id: "vodafone_cash",
    label: t("page_checkout_manual.vodafone_cash", "Vodafone Cash"),
    icon: Wallet,
    enabled: s.vodafone_enabled && !!s.vodafone_number,
    currencies: s.vodafone_currencies as PayCurrency[],
    receiver: [{ label: t("page_checkout_manual.number", "Number"), value: s.vodafone_number }],
  },
  {
    id: "payoneer",
    label: "Payoneer",
    icon: Globe,
    enabled: s.payoneer_enabled && !!s.payoneer_email,
    currencies: s.payoneer_currencies as PayCurrency[],
    receiver: [{ label: t("page_checkout_manual.payoneer_email", "Payoneer email"), value: s.payoneer_email }],
  },
  {
    id: "bank_transfer",
    label: t("page_checkout_manual.bank_transfer", "Bank transfer"),
    icon: Building2,
    enabled:
      s.bank_enabled &&
      !!(s.bank_account_number || s.bank_iban),
    currencies: s.bank_currencies as PayCurrency[],
    receiver: [
      { label: t("page_checkout_manual.bank", "Bank"), value: s.bank_name },
      { label: t("page_checkout_manual.account_holder", "Account holder"), value: s.bank_account_name },
      { label: t("page_checkout_manual.account_number", "Account number"), value: s.bank_account_number },
      { label: "IBAN", value: s.bank_iban },
      { label: "SWIFT", value: s.bank_swift },
    ],
  },
];

const CheckoutManual = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language?.startsWith("ar") ? "ar" : "en";
  const isAr = lang === "ar";
  const [params] = useSearchParams();
  const planTier = (params.get("plan") as PlanTier) || "family";
  const initialCurrency = (params.get("currency") as Currency) || "EGP";
  const navigate = useNavigate();
  const { user } = useAuth();

  const plansQ = useQuery({ queryKey: ["plans"], queryFn: fetchPlans });
  const settingsQ = useQuery({ queryKey: ["payment-settings"], queryFn: fetchPaymentSettings });

  const plan = useMemo(
    () => plansQ.data?.find((p) => p.tier === planTier) ?? null,
    [plansQ.data, planTier],
  );

  const enabledMethods = useMemo<MethodConfig[]>(() => {
    if (!settingsQ.data) return [];
    return buildMethods(settingsQ.data, isAr, t).filter((m) => m.enabled && m.currencies.length > 0);
  }, [settingsQ.data, isAr]);

  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [currency, setCurrency] = useState<Currency>(initialCurrency);
  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [txRef, setTxRef] = useState("");
  const [proof, setProof] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!user) navigate(`/auth?redirect=/checkout/manual?plan=${planTier}`);
  }, [user, navigate, planTier]);

  // Auto-select first enabled method and a compatible currency
  useEffect(() => {
    if (!method && enabledMethods.length > 0) {
      const first = enabledMethods[0];
      setMethod(first.id);
      if (!first.currencies.includes(currency as PayCurrency)) {
        setCurrency(first.currencies[0] as Currency);
      }
    }
  }, [enabledMethods, method, currency]);

  if (!plan || !settingsQ.data) {
    return (
      <div className="py-20 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
      </div>
    );
  }

  if (enabledMethods.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-3">
        <h1 className="text-2xl font-extrabold">
          {t("page_checkout_manual.payments_are_currently_unavailable", "Payments are currently unavailable")}
        </h1>
        <p className="text-muted-foreground">
          {t("page_checkout_manual.the_administrator_has_not_enabled_any_pa", "The administrator has not enabled any payment method yet. Please try later or contact us.")}
        </p>
        <Link
          to="/contact"
          className="inline-block px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-bold"
        >
          {t("page_checkout_manual.contact_us", "Contact us")}
        </Link>
      </div>
    );
  }

  const activeMethod =
    enabledMethods.find((m) => m.id === method) ?? enabledMethods[0];

  // Keep currency in sync when method changes
  const availableCurrencies = activeMethod.currencies as Currency[];
  const safeCurrency: Currency = availableCurrencies.includes(currency)
    ? currency
    : availableCurrencies[0];

  const amount = safeCurrency === "EGP" ? plan.price_egp : plan.price_usd;

  const copy = (val: string | null) => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    toast({ title: t("page_checkout_manual.copied", "Copied"), description: val });
  };

  const submit = async () => {
    if (!user || !proof || !senderName.trim()) {
      toast({
        title: t("page_checkout_manual.missing_fields", "Missing fields"),
        description: t("page_checkout_manual.upload_proof_and_enter_your_name", "Upload proof and enter your name"),
        variant: "destructive",
      });
      return;
    }
    // Basic file validation (image up to 5 MB)
    if (!proof.type.startsWith("image/")) {
      toast({
        title: t("page_checkout_manual.invalid_file", "Invalid file"),
        description: t("page_checkout_manual.proof_must_be_an_image", "Proof must be an image"),
        variant: "destructive",
      });
      return;
    }
    if (proof.size > 5 * 1024 * 1024) {
      toast({
        title: t("page_checkout_manual.file_too_large", "File too large"),
        description: t("page_checkout_manual.max_5_mb", "Max 5 MB"),
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const proofPath = await uploadPaymentProof(user.id, proof);
      await createPaymentRequest({
        userId: user.id,
        planTier,
        amount,
        currency: safeCurrency,
        method: activeMethod.id,
        proofPath,
        senderName: senderName.trim().slice(0, 100),
        senderPhone: senderPhone.trim().slice(0, 30) || undefined,
        transactionRef: txRef.trim().slice(0, 80) || undefined,
      });
      setDone(true);
      toast({
        title: t("page_checkout_manual.submitted", "Submitted!"),
        description: t("page_checkout_manual.reviewed_within_24_hours", "Reviewed within 24 hours"),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: t("page_checkout_manual.error", "Error"), description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center space-y-5">
        <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
        <h1 className="text-2xl font-extrabold">{t("page_checkout_manual.request_received", "Request Received")}</h1>
        <p className="text-muted-foreground">
          {t("page_checkout_manual.we_ll_review_your_proof_and_confirm_the_", "We'll review your proof and confirm the subscription in your account page.")}
        </p>
        <div className="flex gap-2 justify-center">
          <Link
            to="/account/subscription"
            className="px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-bold hover-pop"
          >
            {t("page_checkout_manual.my_account", "My Account")}
          </Link>
          <Link
            to="/"
            className="px-5 py-2.5 rounded-full border-2 border-primary/30 text-primary font-bold"
          >
            {t("page_checkout_manual.home", "Home")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-6 space-y-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-extrabold mb-1">
          {t("page_checkout_manual.complete_subscription_manually", "Complete Subscription Manually")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {isAr
            ? `خطة ${plan.name.ar ?? plan.name.en}`
            : `${plan.name.en ?? plan.name.ar} plan`}
        </p>
      </header>

      {/* Method */}
      <section className="bg-white/95 dark:bg-card/80 rounded-2xl p-5 border-2 border-white/60 space-y-4">
        <h2 className="font-bold">{t("page_checkout_manual.payment_method", "Payment method")}</h2>
        <div className="grid grid-cols-2 gap-3">
          {enabledMethods.map((m) => {
            const Icon = m.icon;
            const active = m.id === activeMethod.id;
            return (
              <button
                key={m.id}
                onClick={() => {
                  setMethod(m.id);
                  if (!m.currencies.includes(currency as PayCurrency)) {
                    setCurrency(m.currencies[0] as Currency);
                  }
                }}
                className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition ${
                  active ? "border-primary bg-primary/5" : "border-muted hover:border-primary/40"
                }`}
              >
                <Icon className="h-6 w-6 text-primary" />
                <span className="font-bold text-sm">{m.label}</span>
                <span className="text-[10px] font-bold text-muted-foreground">
                  {m.currencies.join(" / ")}
                </span>
              </button>
            );
          })}
        </div>

        {/* Receiver details */}
        <div className="bg-muted/50 rounded-xl p-3 space-y-2">
          <p className="text-xs text-muted-foreground">
            {t("page_checkout_manual.transfer_to", "Transfer to:")}
          </p>
          {activeMethod.receiver
            .filter((r) => !!r.value)
            .map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase text-muted-foreground">
                    {r.label}
                  </div>
                  <div className="font-mono font-bold text-foreground break-all text-sm">
                    {r.value}
                  </div>
                </div>
                <button
                  onClick={() => copy(r.value)}
                  className="h-9 w-9 rounded-lg bg-white shrink-0 flex items-center justify-center hover:bg-accent"
                  aria-label="Copy"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            ))}
        </div>
        {(isAr ? settingsQ.data.instructions_ar : settingsQ.data.instructions_en) && (
          <p className="text-xs text-muted-foreground whitespace-pre-line">
            {isAr ? settingsQ.data.instructions_ar : settingsQ.data.instructions_en}
          </p>
        )}
      </section>

      {/* Currency & amount */}
      <section className="bg-white/95 dark:bg-card/80 rounded-2xl p-5 border-2 border-white/60 space-y-3">
        <h2 className="font-bold">{t("page_checkout_manual.currency_amount", "Currency & amount")}</h2>
        <div className="flex gap-2">
          {availableCurrencies.map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className={`px-4 py-2 rounded-full font-bold text-sm border-2 ${
                safeCurrency === c
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-muted text-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="text-3xl font-extrabold text-primary">
          {safeCurrency === "EGP" ? `${plan.price_egp} ج.م` : `$${plan.price_usd}`}
          <span className="text-sm font-normal text-muted-foreground ms-2">
            / {t("page_checkout_manual.month", "month")}
          </span>
        </div>
      </section>

      {/* Sender info + proof */}
      <section className="bg-white/95 dark:bg-card/80 rounded-2xl p-5 border-2 border-white/60 space-y-3">
        <h2 className="font-bold">{t("page_checkout_manual.transfer_details", "Transfer details")}</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-semibold mb-1 block">
              {t("page_checkout_manual.sender_name", "Sender name *")}
            </span>
            <input
              value={senderName}
              onChange={(e) => setSenderName(e.target.value)}
              maxLength={100}
              className="w-full px-3 py-2.5 rounded-xl border-2 border-muted focus:border-primary outline-none bg-background"
              placeholder={t("page_checkout_manual.your_full_name", "Your full name")}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold mb-1 block">
              {t("page_checkout_manual.phone", "Phone")}
            </span>
            <input
              value={senderPhone}
              onChange={(e) => setSenderPhone(e.target.value)}
              inputMode="tel"
              maxLength={30}
              className="w-full px-3 py-2.5 rounded-xl border-2 border-muted focus:border-primary outline-none bg-background"
              placeholder="010xxxxxxxx"
            />
          </label>
        </div>
        <label className="block">
          <span className="text-xs font-semibold mb-1 block">
            {t("page_checkout_manual.transaction_ref_optional", "Transaction ref (optional)")}
          </span>
          <input
            value={txRef}
            onChange={(e) => setTxRef(e.target.value)}
            maxLength={80}
            className="w-full px-3 py-2.5 rounded-xl border-2 border-muted focus:border-primary outline-none bg-background"
          />
        </label>

        {/* Upload */}
        <label className="block">
          <span className="text-xs font-semibold mb-1 block">
            {t("page_checkout_manual.payment_proof_image_up_to_5mb", "Payment proof (image, up to 5MB) *")}
          </span>
          <div className="border-2 border-dashed border-muted rounded-xl p-4 flex flex-col items-center gap-2 hover:border-primary cursor-pointer">
            <UploadCloud className="h-8 w-8 text-muted-foreground" />
            <span className="text-sm font-semibold">
              {proof ? proof.name : t("page_checkout_manual.click_to_choose_image", "Click to choose image")}
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setProof(e.target.files?.[0] ?? null)}
              className="hidden"
            />
          </div>
        </label>
      </section>

      <button
        onClick={submit}
        disabled={submitting || !proof || !senderName.trim()}
        className="w-full px-4 py-3.5 bg-sunset text-kids-midnight rounded-full font-extrabold hover-pop shadow-pop disabled:opacity-50"
      >
        {submitting ? (
          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
        ) : isAr ? (
          "إرسال الطلب"
        ) : (
          "Submit Request"
        )}
      </button>
    </div>
  );
};

export default CheckoutManual;
