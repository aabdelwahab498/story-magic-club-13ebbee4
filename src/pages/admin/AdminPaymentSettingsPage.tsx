import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Save, Smartphone, Wallet, Globe, Building2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  fetchPaymentSettings,
  updatePaymentSettings,
  type PaymentSettings,
  type PayCurrency,
} from "@/lib/subscriptionApi";

const CURRENCIES: PayCurrency[] = ["EGP", "USD"];

const AdminPaymentSettingsPage = () => {
  const { i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");
  const q = useQuery({ queryKey: ["payment-settings"], queryFn: fetchPaymentSettings });
  const [s, setS] = useState<PaymentSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (q.data) setS(q.data);
  }, [q.data]);

  if (q.isLoading || !s)
    return (
      <div className="py-12 flex justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );

  const save = async () => {
    setSaving(true);
    try {
      await updatePaymentSettings(s);
      toast({ title: isAr ? "تم الحفظ" : "Saved" });
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleCurrency = (
    key: "instapay_currencies" | "vodafone_currencies" | "payoneer_currencies" | "bank_currencies",
    c: PayCurrency,
  ) => {
    const list = s[key] ?? [];
    const next = list.includes(c) ? list.filter((x) => x !== c) : [...list, c];
    setS({ ...s, [key]: next });
  };

  const CurrencyChips = ({
    keyName,
    values,
  }: {
    keyName: "instapay_currencies" | "vodafone_currencies" | "payoneer_currencies" | "bank_currencies";
    values: PayCurrency[];
  }) => (
    <div className="flex gap-2">
      {CURRENCIES.map((c) => {
        const active = values.includes(c);
        return (
          <button
            key={c}
            type="button"
            onClick={() => toggleCurrency(keyName, c)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition ${
              active
                ? "bg-primary text-primary-foreground border-primary"
                : "border-muted text-muted-foreground hover:border-primary/40"
            }`}
          >
            {c === "EGP" ? (isAr ? "ج.م" : "EGP") : "USD"}
          </button>
        );
      })}
    </div>
  );

  const MethodCard = ({
    icon: Icon,
    title,
    enabled,
    onToggle,
    children,
  }: {
    icon: typeof Smartphone;
    title: string;
    enabled: boolean;
    onToggle: (v: boolean) => void;
    children: React.ReactNode;
  }) => (
    <div
      className={`rounded-2xl p-5 border-2 transition ${
        enabled ? "border-primary/40 bg-white dark:bg-card" : "border-muted bg-muted/20"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon className="h-4.5 w-4.5 text-primary" />
          </div>
          <h3 className="font-extrabold">{title}</h3>
        </div>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <span className="text-xs font-bold text-muted-foreground">
            {enabled ? (isAr ? "مُفعّل" : "Enabled") : (isAr ? "مُعطّل" : "Disabled")}
          </span>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
            className="h-5 w-9 appearance-none bg-muted rounded-full relative cursor-pointer transition checked:bg-primary before:content-[''] before:absolute before:top-0.5 before:start-0.5 before:h-4 before:w-4 before:bg-white before:rounded-full before:transition checked:before:translate-x-4 rtl:checked:before:-translate-x-4"
          />
        </label>
      </div>
      {enabled && <div className="space-y-3">{children}</div>}
    </div>
  );

  const inputCls =
    "w-full p-2.5 rounded-lg border-2 border-muted bg-background focus:border-primary outline-none";

  return (
    <div className="max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold">
          {isAr ? "وسائل الدفع اليدوية" : "Manual Payment Methods"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isAr
            ? "فعّل الطرق التي تريد إتاحتها للعملاء وحدّد العملات المقبولة لكل طريقة. يجب رفع إثبات الدفع من العميل."
            : "Enable the methods you want to offer and choose the accepted currencies for each. Customers must upload proof of payment."}
        </p>
      </header>

      {/* InstaPay */}
      <MethodCard
        icon={Smartphone}
        title={isAr ? "انستا باي (InstaPay)" : "InstaPay"}
        enabled={s.instapay_enabled}
        onToggle={(v) => setS({ ...s, instapay_enabled: v })}
      >
        <label className="block">
          <span className="text-xs font-bold mb-1 block">
            {isAr ? "حساب الاستلام" : "InstaPay handle"}
          </span>
          <input
            value={s.instapay_handle ?? ""}
            onChange={(e) => setS({ ...s, instapay_handle: e.target.value })}
            className={inputCls}
            placeholder="name@instapay"
          />
        </label>
        <div>
          <span className="text-xs font-bold mb-1 block">
            {isAr ? "العملات المقبولة" : "Accepted currencies"}
          </span>
          <CurrencyChips keyName="instapay_currencies" values={s.instapay_currencies} />
        </div>
      </MethodCard>

      {/* Vodafone Cash */}
      <MethodCard
        icon={Wallet}
        title={isAr ? "فودافون كاش" : "Vodafone Cash"}
        enabled={s.vodafone_enabled}
        onToggle={(v) => setS({ ...s, vodafone_enabled: v })}
      >
        <label className="block">
          <span className="text-xs font-bold mb-1 block">
            {isAr ? "رقم فودافون كاش" : "Vodafone Cash number"}
          </span>
          <input
            value={s.vodafone_number ?? ""}
            onChange={(e) => setS({ ...s, vodafone_number: e.target.value })}
            className={inputCls}
            placeholder="010xxxxxxxx"
          />
        </label>
        <div>
          <span className="text-xs font-bold mb-1 block">
            {isAr ? "العملات المقبولة" : "Accepted currencies"}
          </span>
          <CurrencyChips keyName="vodafone_currencies" values={s.vodafone_currencies} />
        </div>
      </MethodCard>

      {/* Payoneer */}
      <MethodCard
        icon={Globe}
        title="Payoneer"
        enabled={s.payoneer_enabled}
        onToggle={(v) => setS({ ...s, payoneer_enabled: v })}
      >
        <label className="block">
          <span className="text-xs font-bold mb-1 block">
            {isAr ? "البريد الإلكتروني لحساب Payoneer" : "Payoneer email"}
          </span>
          <input
            type="email"
            value={s.payoneer_email ?? ""}
            onChange={(e) => setS({ ...s, payoneer_email: e.target.value })}
            className={inputCls}
            placeholder="payments@example.com"
          />
        </label>
        <div>
          <span className="text-xs font-bold mb-1 block">
            {isAr ? "العملات المقبولة" : "Accepted currencies"}
          </span>
          <CurrencyChips keyName="payoneer_currencies" values={s.payoneer_currencies} />
        </div>
      </MethodCard>

      {/* Bank Transfer */}
      <MethodCard
        icon={Building2}
        title={isAr ? "تحويل بنكي" : "Bank transfer"}
        enabled={s.bank_enabled}
        onToggle={(v) => setS({ ...s, bank_enabled: v })}
      >
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-bold mb-1 block">{isAr ? "اسم البنك" : "Bank name"}</span>
            <input
              value={s.bank_name ?? ""}
              onChange={(e) => setS({ ...s, bank_name: e.target.value })}
              className={inputCls}
              placeholder={isAr ? "مثال: CIB" : "e.g. CIB"}
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold mb-1 block">
              {isAr ? "اسم صاحب الحساب" : "Account holder name"}
            </span>
            <input
              value={s.bank_account_name ?? ""}
              onChange={(e) => setS({ ...s, bank_account_name: e.target.value })}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold mb-1 block">
              {isAr ? "رقم الحساب" : "Account number"}
            </span>
            <input
              value={s.bank_account_number ?? ""}
              onChange={(e) => setS({ ...s, bank_account_number: e.target.value })}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="text-xs font-bold mb-1 block">IBAN</span>
            <input
              value={s.bank_iban ?? ""}
              onChange={(e) => setS({ ...s, bank_iban: e.target.value })}
              className={inputCls}
              placeholder="EG.."
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-xs font-bold mb-1 block">SWIFT / BIC</span>
            <input
              value={s.bank_swift ?? ""}
              onChange={(e) => setS({ ...s, bank_swift: e.target.value })}
              className={inputCls}
            />
          </label>
        </div>
        <div>
          <span className="text-xs font-bold mb-1 block">
            {isAr ? "العملات المقبولة" : "Accepted currencies"}
          </span>
          <CurrencyChips keyName="bank_currencies" values={s.bank_currencies} />
        </div>
      </MethodCard>

      {/* Instructions */}
      <div className="bg-white dark:bg-card rounded-2xl p-5 border-2 border-muted space-y-3">
        <h3 className="font-extrabold">
          {isAr ? "تعليمات تظهر للعميل" : "Instructions shown to customers"}
        </h3>
        <label className="block">
          <span className="text-xs font-bold mb-1 block">
            {isAr ? "تعليمات (عربي)" : "Instructions (AR)"}
          </span>
          <textarea
            value={s.instructions_ar ?? ""}
            onChange={(e) => setS({ ...s, instructions_ar: e.target.value })}
            rows={3}
            className={inputCls}
            placeholder={isAr ? "بعد التحويل، ارفع صورة إثبات الدفع..." : ""}
          />
        </label>
        <label className="block">
          <span className="text-xs font-bold mb-1 block">
            {isAr ? "تعليمات (إنجليزي)" : "Instructions (EN)"}
          </span>
          <textarea
            value={s.instructions_en ?? ""}
            onChange={(e) => setS({ ...s, instructions_en: e.target.value })}
            rows={3}
            className={inputCls}
            placeholder="After transfer, upload payment proof..."
          />
        </label>
      </div>

      <div className="sticky bottom-4 flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-3 rounded-full bg-primary text-primary-foreground font-extrabold inline-flex items-center gap-2 disabled:opacity-50 shadow-pop hover-pop"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isAr ? "حفظ التغييرات" : "Save changes"}
        </button>
      </div>
    </div>
  );
};

export default AdminPaymentSettingsPage;
