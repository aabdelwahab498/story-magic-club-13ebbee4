import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMethodsForRegion, type Region } from "@/lib/paymentMethods";

interface PaymentMethodSelectorProps {
  region: Region;
  selected: string | null;
  onSelect: (id: string) => void;
}

const PaymentMethodSelector = ({ region, selected, onSelect }: PaymentMethodSelectorProps) => {
  const { t } = useTranslation();
  const methods = getMethodsForRegion(region);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {methods.map((m) => {
        const Icon = m.icon;
        const isActive = selected === m.id;
        const multiCurrency = m.currencies.length > 1;
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => onSelect(m.id)}
            className={cn(
              "relative text-start p-3 rounded-2xl border-2 transition-all hover-pop bg-white/95 dark:bg-card/90",
              isActive
                ? "border-primary shadow-glow ring-2 ring-primary/30"
                : "border-white/60 hover:border-primary/40",
            )}
            aria-pressed={isActive}
          >
            <div className="flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-white shrink-0", m.gradient)}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-foreground text-sm">
                  {t(`payment.methods.${m.id}.name`, { defaultValue: m.name })}
                </div>
                <div className="text-xs text-muted-foreground line-clamp-2">
                  {t(`payment.methods.${m.id}.desc`, { defaultValue: m.desc })}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {m.currencies.map((c) => (
                    <span
                      key={c}
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-muted/60 text-muted-foreground"
                    >
                      {c}
                    </span>
                  ))}
                  {multiCurrency && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                      {t("payment.choose_currency_badge", { defaultValue: "Choose currency" })}
                    </span>
                  )}
                </div>
              </div>
              {isActive && (
                <div className="absolute top-2 end-2 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  <Check className="h-3 w-3" />
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default PaymentMethodSelector;
