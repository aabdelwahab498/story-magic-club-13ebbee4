import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { convertPrice, formatPrice, type Currency } from "@/lib/paymentMethods";

interface CurrencySelectorProps {
  available: Currency[];
  selected: Currency;
  onSelect: (c: Currency) => void;
  /** Base price + base currency to preview converted amount. */
  basePrice: number;
  baseCurrency: Currency;
}

const FLAGS: Record<Currency, string> = {
  EGP: "🇪🇬",
  USD: "🇺🇸",
  EUR: "🇪🇺",
};

const CurrencySelector = ({
  available,
  selected,
  onSelect,
  basePrice,
  baseCurrency,
}: CurrencySelectorProps) => {
  const { t } = useTranslation();
  return (
    <div>
      <p className="text-sm font-bold text-foreground mb-2">
        {t("payment.currency_label", { defaultValue: "Pay in which currency?" })}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {available.map((c) => {
          const isActive = selected === c;
          const converted = convertPrice(basePrice, baseCurrency, c);
          return (
            <button
              key={c}
              type="button"
              onClick={() => onSelect(c)}
              className={cn(
                "relative p-3 rounded-2xl border-2 transition-all bg-white/95 dark:bg-card/90 text-center hover-pop",
                isActive
                  ? "border-primary shadow-glow ring-2 ring-primary/30"
                  : "border-white/60 hover:border-primary/40",
              )}
              aria-pressed={isActive}
            >
              <div className="text-xl mb-0.5">{FLAGS[c]}</div>
              <div className="font-extrabold text-foreground text-sm">{c}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {formatPrice(converted, c)}
              </div>
              {isActive && (
                <div className="absolute top-1.5 end-1.5 h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  <Check className="h-2.5 w-2.5" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CurrencySelector;
