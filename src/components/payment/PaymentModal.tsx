import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  COUNTRIES,
  detectCountry,
  saveLastCountry,
  saveLastMethod,
  getLastMethod,
  getLastCurrency,
  saveLastCurrency,
  getMethod,
  getMethodsForRegion,
  getDefaultMethodForRegion,
  convertPrice,
  type Currency,
} from "@/lib/paymentMethods";
import PaymentMethodSelector from "./PaymentMethodSelector";
import PaymentMethodForms, { isPaymentFormValid, type PaymentFormData } from "./PaymentMethodForms";
import PaymentSummary, { type PaymentItem } from "./PaymentSummary";
import PaymentSuccess from "./PaymentSuccess";
import PaymentError from "./PaymentError";
import CurrencySelector from "./CurrencySelector";
import SpinWheelModal from "@/components/SpinWheelModal";

interface PaymentModalProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: PaymentItem;
  onComplete?: () => void;
}

type Step = 1 | 2 | 3;
type Status = "idle" | "processing" | "success" | "error";

const PaymentModal = ({ open, onOpenChange, item, onComplete }: PaymentModalProps) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>(1);
  const [country, setCountry] = useState<string>("US");
  const [method, setMethod] = useState<string | null>(null);
  const [currency, setCurrency] = useState<Currency>((item.currency as Currency) || "USD");
  const [status, setStatus] = useState<Status>("idle");
  const [formData, setFormData] = useState<PaymentFormData>({});
  const [spinOpen, setSpinOpen] = useState(false);

  const region = useMemo(
    () => COUNTRIES.find((c) => c.code === country)?.region ?? "international",
    [country],
  );

  const methodObj = useMemo(() => getMethod(method), [method]);
  const baseCurrency = (item.currency as Currency) || "USD";

  // Reset / autodetect on open
  useEffect(() => {
    if (open) {
      const detected = detectCountry();
      setCountry(detected);
      const detectedRegion = COUNTRIES.find((c) => c.code === detected)?.region ?? "international";
      const last = getLastMethod();
      const lastValid = last && getMethodsForRegion(detectedRegion).some((m) => m.id === last);
      setMethod(lastValid ? last : getDefaultMethodForRegion(detectedRegion));
      setStep(1);
      setStatus("idle");
      setFormData({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Auto-fix method when region changes
  useEffect(() => {
    if (!method) return;
    const allowed = getMethodsForRegion(region).map((m) => m.id);
    if (!allowed.includes(method)) {
      setMethod(getDefaultMethodForRegion(region));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region]);

  // When method changes, reconcile currency to one supported by the method.
  useEffect(() => {
    if (!methodObj) return;
    const supported = methodObj.currencies;
    if (supported.length === 1) {
      setCurrency(supported[0]);
      return;
    }
    // Prefer: country currency → last used → base item currency → first supported
    const countryCur = COUNTRIES.find((c) => c.code === country)?.currency;
    const last = getLastCurrency();
    const candidates: (Currency | undefined)[] = [
      countryCur,
      last ?? undefined,
      baseCurrency,
    ];
    const pick = candidates.find((c) => c && supported.includes(c)) ?? supported[0];
    setCurrency(pick as Currency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, country]);

  // Reset form fields whenever the chosen method changes.
  useEffect(() => {
    setFormData({});
  }, [method]);

  const handleCountry = (code: string) => {
    setCountry(code);
    saveLastCountry(code);
  };

  const handleConfirm = () => {
    if (!method) return;
    saveLastMethod(method);
    saveLastCurrency(currency);
    setStatus("processing");
    setTimeout(() => {
      const ok = Math.random() > 0.15;
      setStatus(ok ? "success" : "error");
      if (ok) onComplete?.();
    }, 1600);
  };

  const close = () => {
    onOpenChange(false);
  };

  const stepLabels = [
    t("payment.steps.country"),
    t("payment.steps.method"),
    t("payment.steps.confirm"),
  ];

  const displayPrice = convertPrice(item.price, baseCurrency, currency);
  const showCurrencyPicker = (methodObj?.currencies.length ?? 1) > 1;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border-2 border-white/60 bg-gradient-to-br from-background via-background to-kids-softPurple/20">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold text-foreground">
              {status === "success"
                ? t("payment.title_success")
                : status === "error"
                ? t("payment.title_error")
                : t("payment.title")}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {status === "idle" && t("payment.subtitle")}
            </DialogDescription>
          </DialogHeader>

          {status === "success" && (
            <PaymentSuccess
              itemName={item.name}
              onContinue={close}
              onSpinReward={() => setSpinOpen(true)}
            />
          )}

          {status === "error" && (
            <PaymentError
              onRetry={() => setStatus("idle")}
              onCancel={close}
            />
          )}

          {status === "processing" && (
            <div className="py-10 text-center">
              <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary mb-3" />
              <p className="font-bold text-foreground">{t("payment.processing")}</p>
              <p className="text-sm text-muted-foreground">{t("payment.processing_desc")}</p>
            </div>
          )}

          {status === "idle" && (
            <>
              {/* Step indicator */}
              <div className="flex items-center justify-between gap-1 mb-1">
                {([1, 2, 3] as Step[]).map((s, i) => (
                  <div key={s} className="flex items-center gap-1 flex-1">
                    <div
                      className={cn(
                        "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all",
                        step >= s
                          ? "bg-primary text-primary-foreground shadow-soft"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {s}
                    </div>
                    <span className={cn("text-xs font-semibold hidden sm:block", step >= s ? "text-foreground" : "text-muted-foreground")}>
                      {stepLabels[i]}
                    </span>
                    {i < 2 && (
                      <div className={cn("h-0.5 flex-1 rounded-full transition-all", step > s ? "bg-primary" : "bg-muted")} />
                    )}
                  </div>
                ))}
              </div>

              {/* Step 1 — country */}
              {step === 1 && (
                <div className="space-y-3">
                  <PaymentSummary item={item} compact />
                  <label className="block">
                    <span className="text-sm font-bold text-foreground mb-2 block">
                      {t("payment.country_label")}
                    </span>
                    <select
                      value={country}
                      onChange={(e) => handleCountry(e.target.value)}
                      className="w-full px-3 py-3 rounded-2xl bg-white/95 dark:bg-card/80 border-2 border-white/60 focus:border-primary focus:outline-none font-semibold text-foreground"
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className="text-xs text-muted-foreground">
                    {region === "egypt" ? t("payment.region_hint_eg") : t("payment.region_hint_intl")}
                  </p>
                  <button
                    onClick={() => setStep(2)}
                    className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-full font-bold hover-pop shadow-soft inline-flex items-center justify-center gap-2"
                  >
                    {t("payment.next")}
                    <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                  </button>
                </div>
              )}

              {/* Step 2 — method (+ currency picker if needed) */}
              {step === 2 && (
                <div className="space-y-3">
                  <PaymentMethodSelector region={region} selected={method} onSelect={setMethod} />
                  {showCurrencyPicker && methodObj && (
                    <CurrencySelector
                      available={methodObj.currencies}
                      selected={currency}
                      onSelect={setCurrency}
                      basePrice={item.price}
                      baseCurrency={baseCurrency}
                    />
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setStep(1)}
                      className="flex-1 px-4 py-2.5 bg-transparent border-2 border-muted-foreground/30 text-foreground rounded-full font-bold hover:bg-muted/40 transition-colors"
                    >
                      {t("payment.back")}
                    </button>
                    <button
                      onClick={() => setStep(3)}
                      disabled={!method}
                      className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-full font-bold hover-pop shadow-soft disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                    >
                      {t("payment.next")}
                      <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3 — confirm */}
              {step === 3 && method && (
                <div className="space-y-3">
                  <PaymentSummary
                    item={item}
                    displayPrice={displayPrice}
                    displayCurrency={currency}
                  />
                  <PaymentMethodForms methodId={method} value={formData} onChange={setFormData} />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setStep(2)}
                      className="flex-1 px-4 py-2.5 bg-transparent border-2 border-muted-foreground/30 text-foreground rounded-full font-bold hover:bg-muted/40 transition-colors"
                    >
                      {t("payment.back")}
                    </button>
                    <button
                      onClick={handleConfirm}
                      disabled={!isPaymentFormValid(method, formData)}
                      className="flex-1 px-4 py-3 bg-sunset text-kids-midnight rounded-full font-bold hover-pop shadow-pop disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                      {t("payment.proceed")}
                    </button>
                  </div>
                  {!isPaymentFormValid(method, formData) && (
                    <p className="text-xs text-center text-muted-foreground">
                      {t("payment.fill_required", { defaultValue: "Please complete all required fields to continue." })}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <SpinWheelModal open={spinOpen} onOpenChange={setSpinOpen} />
    </>
  );
};

export default PaymentModal;
