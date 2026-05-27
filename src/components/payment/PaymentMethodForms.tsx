import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { QrCode, Receipt, CreditCard, Building2, Smartphone, Copy, Wallet, CheckCircle2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export type InstapayMode = "phone" | "card";

export interface PaymentFormData {
  // card-like
  cardNumber?: string;
  cardholder?: string;
  expiry?: string;
  cvv?: string;
  // wallet / phone
  phone?: string;
  // InstaPay supports paying via phone OR via bank card
  instapayMode?: InstapayMode;
  instapayHandle?: string;
  // confirmations
  confirmed?: boolean;
}

interface FormProps {
  methodId: string;
  value: PaymentFormData;
  onChange: (next: PaymentFormData) => void;
}

const Field = ({
  label,
  placeholder,
  type = "text",
  value,
  onChange,
  invalid,
  inputMode,
  maxLength,
}: {
  label: string;
  placeholder: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  inputMode?: "text" | "numeric" | "tel";
  maxLength?: number;
}) => (
  <label className="block">
    <span className="text-xs font-semibold text-muted-foreground mb-1 block">{label}</span>
    <input
      type={type}
      inputMode={inputMode}
      maxLength={maxLength}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={invalid || undefined}
      className={`w-full px-3 py-2.5 rounded-xl bg-white/95 dark:bg-card/80 border-2 focus:outline-none text-sm text-foreground transition-colors ${
        invalid
          ? "border-destructive/70 focus:border-destructive"
          : "border-white/60 focus:border-primary"
      }`}
    />
  </label>
);

const PaymentMethodForms = ({ methodId, value, onChange }: FormProps) => {
  const { t } = useTranslation();
  const [touched, setTouched] = useState(false);

  // Mark fields as "touched" once the user starts typing so we don't show errors immediately
  useEffect(() => {
    if (
      value.cardNumber || value.cardholder || value.expiry || value.cvv || value.phone
    ) {
      setTouched(true);
    }
  }, [value]);

  const set = (patch: Partial<PaymentFormData>) => onChange({ ...value, ...patch });

  if (methodId === "instapay") {
    const mode: InstapayMode = value.instapayMode ?? "phone";
    const handle = value.instapayHandle ?? "";
    const phone = value.phone ?? "";
    const cardNumber = value.cardNumber ?? "";
    const cardholder = value.cardholder ?? "";
    const expiry = value.expiry ?? "";
    const cvv = value.cvv ?? "";
    const cardDigits = cardNumber.replace(/\s/g, "");
    return (
      <div className="bg-white/95 dark:bg-card/80 rounded-2xl p-5 border-2 border-white/60 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white">
            <QrCode className="h-6 w-6" />
          </div>
          <div>
            <p className="font-bold text-foreground text-sm">{t("payment.forms.instapay_title")}</p>
            <p className="text-xs text-muted-foreground">{t("payment.forms.instapay_desc")}</p>
          </div>
        </div>

        {/* Mode switcher */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-muted/50 rounded-xl">
          <button
            type="button"
            onClick={() => set({ instapayMode: "phone" })}
            className={`px-3 py-2 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-all ${
              mode === "phone"
                ? "bg-white dark:bg-card text-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Smartphone className="h-3.5 w-3.5" />
            {t("payment.forms.instapay_mode_phone", { defaultValue: "Phone / Wallet" })}
          </button>
          <button
            type="button"
            onClick={() => set({ instapayMode: "card" })}
            className={`px-3 py-2 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-all ${
              mode === "card"
                ? "bg-white dark:bg-card text-foreground shadow-soft"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <CreditCard className="h-3.5 w-3.5" />
            {t("payment.forms.instapay_mode_card", { defaultValue: "Bank Card" })}
          </button>
        </div>

        {mode === "phone" ? (
          <div className="space-y-3">
            <Field
              label={t("payment.forms.instapay_phone", { defaultValue: "Mobile number" })}
              placeholder="010xxxxxxxx"
              type="tel"
              inputMode="tel"
              maxLength={11}
              value={phone}
              onChange={(v) => set({ phone: v.replace(/\D/g, "").slice(0, 11) })}
              invalid={touched && phone.length > 0 && !/^01[0125]\d{8}$/.test(phone)}
            />
            <Field
              label={t("payment.forms.instapay_handle", { defaultValue: "InstaPay address (optional)" })}
              placeholder="name@instapay"
              value={handle}
              onChange={(v) => set({ instapayHandle: v })}
            />
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl p-3 text-xs text-foreground">
              {t("payment.forms.instapay_phone_hint", {
                defaultValue: "You'll receive a confirmation request on your InstaPay app.",
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Field
              label={t("payment.forms.card_number")}
              placeholder="1234 5678 9012 3456"
              value={cardNumber}
              inputMode="numeric"
              maxLength={19}
              onChange={(v) => {
                const digits = v.replace(/\D/g, "").slice(0, 16);
                const grouped = digits.replace(/(.{4})/g, "$1 ").trim();
                set({ cardNumber: grouped });
              }}
              invalid={touched && cardDigits.length > 0 && cardDigits.length < 13}
            />
            <Field
              label={t("payment.forms.cardholder")}
              placeholder={t("payment.forms.cardholder_ph")}
              value={cardholder}
              onChange={(v) => set({ cardholder: v })}
              invalid={touched && cardholder.trim().length > 0 && cardholder.trim().length < 3}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label={t("payment.forms.expiry")}
                placeholder="MM/YY"
                value={expiry}
                inputMode="numeric"
                maxLength={5}
                onChange={(v) => {
                  const d = v.replace(/\D/g, "").slice(0, 4);
                  const out = d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
                  set({ expiry: out });
                }}
                invalid={touched && expiry.length > 0 && !/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)}
              />
              <Field
                label="CVV"
                placeholder="123"
                type="password"
                value={cvv}
                inputMode="numeric"
                maxLength={4}
                onChange={(v) => set({ cvv: v.replace(/\D/g, "").slice(0, 4) })}
                invalid={touched && cvv.length > 0 && cvv.length < 3}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  if (methodId === "fawry") {
    const code = "8472-3910-2056";
    const copy = () => {
      navigator.clipboard?.writeText(code);
      toast({ title: t("payment.forms.copied"), description: code });
    };
    return (
      <div className="bg-white/95 dark:bg-card/80 rounded-2xl p-5 border-2 border-white/60 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white">
            <Receipt className="h-6 w-6" />
          </div>
          <div>
            <p className="font-bold text-foreground text-sm">{t("payment.forms.fawry_title")}</p>
            <p className="text-xs text-muted-foreground">{t("payment.forms.fawry_desc")}</p>
          </div>
        </div>
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl p-3 flex items-center justify-between">
          <span className="font-mono font-bold text-foreground tracking-wider">{code}</span>
          <button onClick={copy} className="h-8 w-8 rounded-lg bg-white/80 hover:bg-white flex items-center justify-center">
            <Copy className="h-4 w-4 text-amber-700" />
          </button>
        </div>
        <label className="flex items-start gap-2 text-xs text-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={!!value.confirmed}
            onChange={(e) => set({ confirmed: e.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-2 border-primary/60 accent-primary"
          />
          <span className="text-start">
            {t("payment.forms.fawry_confirm", { defaultValue: "I saved the reference code" })}
          </span>
        </label>
      </div>
    );
  }

  if (methodId === "paymob" || methodId === "card") {
    const cardNumber = value.cardNumber ?? "";
    const cardholder = value.cardholder ?? "";
    const expiry = value.expiry ?? "";
    const cvv = value.cvv ?? "";
    const cardDigits = cardNumber.replace(/\s/g, "");
    return (
      <div className="bg-white/95 dark:bg-card/80 rounded-2xl p-4 border-2 border-white/60 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <CreditCard className="h-5 w-5 text-primary" />
          <span className="font-bold text-foreground text-sm">
            {t(methodId === "paymob" ? "payment.forms.paymob_title" : "payment.forms.card_title")}
          </span>
        </div>
        <Field
          label={t("payment.forms.card_number")}
          placeholder="1234 5678 9012 3456"
          value={cardNumber}
          inputMode="numeric"
          maxLength={19}
          onChange={(v) => {
            const digits = v.replace(/\D/g, "").slice(0, 16);
            const grouped = digits.replace(/(.{4})/g, "$1 ").trim();
            set({ cardNumber: grouped });
          }}
          invalid={touched && cardDigits.length > 0 && cardDigits.length < 13}
        />
        <Field
          label={t("payment.forms.cardholder")}
          placeholder={t("payment.forms.cardholder_ph")}
          value={cardholder}
          onChange={(v) => set({ cardholder: v })}
          invalid={touched && cardholder.trim().length > 0 && cardholder.trim().length < 3}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label={t("payment.forms.expiry")}
            placeholder="MM/YY"
            value={expiry}
            inputMode="numeric"
            maxLength={5}
            onChange={(v) => {
              const d = v.replace(/\D/g, "").slice(0, 4);
              const out = d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
              set({ expiry: out });
            }}
            invalid={touched && expiry.length > 0 && !/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)}
          />
          <Field
            label="CVV"
            placeholder="123"
            type="password"
            value={cvv}
            inputMode="numeric"
            maxLength={4}
            onChange={(v) => set({ cvv: v.replace(/\D/g, "").slice(0, 4) })}
            invalid={touched && cvv.length > 0 && cvv.length < 3}
          />
        </div>
      </div>
    );
  }

  if (methodId === "vodafone_cash") {
    const phone = value.phone ?? "";
    return (
      <div className="bg-white/95 dark:bg-card/80 rounded-2xl p-5 border-2 border-white/60 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center text-white">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <p className="font-bold text-foreground text-sm">{t("payment.forms.vodafone_title")}</p>
            <p className="text-xs text-muted-foreground">{t("payment.forms.vodafone_desc")}</p>
          </div>
        </div>
        <Field
          label={t("payment.forms.vodafone_phone")}
          placeholder="010xxxxxxxx"
          type="tel"
          inputMode="tel"
          maxLength={11}
          value={phone}
          onChange={(v) => set({ phone: v.replace(/\D/g, "").slice(0, 11) })}
          invalid={touched && phone.length > 0 && !/^01[0125]\d{8}$/.test(phone)}
        />
        <div className="bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/20 dark:to-rose-900/20 rounded-xl p-3 text-xs text-foreground">
          {t("payment.forms.vodafone_hint")}
        </div>
      </div>
    );
  }

  if (methodId === "bank") {
    return (
      <div className="bg-white/95 dark:bg-card/80 rounded-2xl p-5 border-2 border-white/60 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center text-white">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <p className="font-bold text-foreground text-sm">{t("payment.forms.bank_title")}</p>
            <p className="text-xs text-muted-foreground">{t("payment.forms.bank_desc")}</p>
          </div>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between bg-muted/40 rounded-lg px-3 py-2">
            <span className="text-muted-foreground">IBAN</span>
            <span className="font-mono font-semibold text-foreground">DE89 3704 0044 0532 0130 00</span>
          </div>
          <div className="flex justify-between bg-muted/40 rounded-lg px-3 py-2">
            <span className="text-muted-foreground">SWIFT</span>
            <span className="font-mono font-semibold text-foreground">NAJMAHDE01</span>
          </div>
        </div>
        <label className="flex items-start gap-2 text-xs text-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={!!value.confirmed}
            onChange={(e) => set({ confirmed: e.target.checked })}
            className="mt-0.5 h-4 w-4 rounded border-2 border-primary/60 accent-primary"
          />
          <span className="text-start inline-flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
            {t("payment.forms.bank_confirm", { defaultValue: "I have initiated the wire transfer" })}
          </span>
        </label>
      </div>
    );
  }

  return null;
};

/** Pure validator the parent uses to enable/disable Proceed. */
export const isPaymentFormValid = (methodId: string | null, v: PaymentFormData): boolean => {
  if (!methodId) return false;
  switch (methodId) {
    case "instapay": {
      const mode: InstapayMode = v.instapayMode ?? "phone";
      if (mode === "phone") {
        return /^01[0125]\d{8}$/.test(v.phone ?? "");
      }
      const digits = (v.cardNumber ?? "").replace(/\s/g, "");
      const nameOk = (v.cardholder ?? "").trim().length >= 3;
      const expOk = /^(0[1-9]|1[0-2])\/\d{2}$/.test(v.expiry ?? "");
      const cvvOk = /^\d{3,4}$/.test(v.cvv ?? "");
      return digits.length >= 13 && digits.length <= 16 && nameOk && expOk && cvvOk;
    }
    case "fawry":
    case "bank":
      return !!v.confirmed;
    case "vodafone_cash":
      return /^01[0125]\d{8}$/.test(v.phone ?? "");
    case "paymob":
    case "card": {
      const digits = (v.cardNumber ?? "").replace(/\s/g, "");
      const nameOk = (v.cardholder ?? "").trim().length >= 3;
      const expOk = /^(0[1-9]|1[0-2])\/\d{2}$/.test(v.expiry ?? "");
      const cvvOk = /^\d{3,4}$/.test(v.cvv ?? "");
      return digits.length >= 13 && digits.length <= 16 && nameOk && expOk && cvvOk;
    }
    default:
      return false;
  }
};

export default PaymentMethodForms;
