import { useTranslation } from "react-i18next";
import { formatPrice, type Currency } from "@/lib/paymentMethods";

export interface PaymentItem {
  name: string;
  qty?: number;
  price: number;
  currency: Currency | string;
  cycle?: "monthly" | "yearly" | "one-time";
}

interface PaymentSummaryProps {
  item: PaymentItem;
  /** Optional override price/currency (e.g. after currency conversion) */
  displayPrice?: number;
  displayCurrency?: Currency;
  compact?: boolean;
}

const PaymentSummary = ({ item, displayPrice, displayCurrency, compact = false }: PaymentSummaryProps) => {
  const { t } = useTranslation();
  const qty = item.qty ?? 1;
  const baseTotal = item.price * qty;
  const total = displayPrice !== undefined ? displayPrice * qty : baseTotal;
  const currency = (displayCurrency ?? (item.currency as Currency)) as Currency;
  const showOriginal =
    displayCurrency !== undefined && displayCurrency !== item.currency;

  return (
    <div className={`bg-gradient-to-br from-kids-softYellow/60 to-kids-softPurple/40 dark:from-card/80 dark:to-card/60 rounded-2xl border-2 border-white/60 ${compact ? "p-3" : "p-4"}`}>
      <h4 className="font-bold text-foreground mb-2 text-sm">
        {t("payment.summary.title")}
      </h4>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-muted-foreground">{t("payment.summary.item")}</span>
        <span className="font-semibold text-foreground text-end">{item.name}</span>
      </div>
      {qty > 1 && (
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-muted-foreground">{t("payment.summary.qty")}</span>
          <span className="font-semibold text-foreground">×{qty}</span>
        </div>
      )}
      {item.cycle && item.cycle !== "one-time" && (
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-muted-foreground">{t("payment.summary.billing")}</span>
          <span className="font-semibold text-foreground capitalize">
            {t(`pricing.cycle.${item.cycle}`)}
          </span>
        </div>
      )}
      <div className="border-t-2 border-dashed border-white/70 dark:border-white/10 my-2" />
      <div className="flex items-baseline justify-between">
        <span className="font-bold text-foreground">{t("payment.summary.total")}</span>
        <div className="text-end">
          <div className="text-xl font-extrabold text-primary">
            {formatPrice(total, currency)}
          </div>
          {showOriginal && (
            <div className="text-[11px] text-muted-foreground">
              ≈ {formatPrice(baseTotal, item.currency as Currency)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentSummary;
