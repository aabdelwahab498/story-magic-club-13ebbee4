import { useTranslation } from "react-i18next";
import { Sparkles, Loader2, Award } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useCredits } from "@/hooks/useCredits";
import { useSubscription } from "@/hooks/useSubscription";
import { getLocalized } from "@/lib/multilingual";

/**
 * Credit counter pill for the navbar.
 * Data source: useCredits() -> fetches from backend API.
 */
const CreditCounter = () => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { balance, isLoading: creditsLoading, error: creditsError } = useCredits();
  const { plan, tier, loading: planLoading } = useSubscription();

  if (!user) return null;

  const label = t("nav.credits", "Credits");
  const value = creditsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : balance;

  const low = !creditsLoading && balance <= 2;

  if (creditsError) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {/* Plan Badge */}
      <div
        title="Subscription Plan"
        className="inline-flex items-center gap-1.5 rounded-full border-2 border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-bold text-primary dark:bg-primary/10 transition-colors"
      >
        <Award className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Plan:</span>
        <span>{planLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : (getLocalized(plan?.name, i18n.language) || tier)}</span>
      </div>

      {/* Credit Counter */}
      <div
        title={`${label}: ${balance}`}
        className={`inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1 text-xs font-bold shadow-soft transition-colors ${
          low
            ? "border-destructive/40 bg-destructive/10 text-destructive"
            : "border-primary/30 bg-primary/10 text-primary dark:bg-primary/20"
        }`}
        aria-label={`${label} ${balance}`}
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{label}:</span>
        <span>{value}</span>
      </div>
    </div>
  );
};

export default CreditCounter;
