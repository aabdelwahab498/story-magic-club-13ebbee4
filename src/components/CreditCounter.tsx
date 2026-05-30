import { useTranslation } from "react-i18next";
import { Sparkles, Infinity as InfinityIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";

/**
 * Credit counter pill for the navbar.
 * Data source: useSubscription() -> subscription_plans.monthly_story_limit
 * and ai_story_history count this month (storiesUsedThisMonth).
 * Purely presentational — no business logic changes.
 */
const CreditCounter = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { loading, tier, plan, storiesUsedThisMonth } = useSubscription();

  if (!user) return null;

  const label = t("nav.credits", "Credits");
  const unlimited = tier === "elite";
  const limit = plan?.monthly_story_limit;

  const unavailable = loading || (!unlimited && (limit === undefined || limit === null));

  let value: React.ReactNode;
  if (unavailable) {
    value = "--";
  } else if (unlimited) {
    value = (
      <span className="inline-flex items-center gap-1">
        <InfinityIcon className="h-3.5 w-3.5" />
        {t("nav.unlimited", "Unlimited")}
      </span>
    );
  } else {
    const used = storiesUsedThisMonth ?? 0;
    const remaining = Math.max(0, (limit ?? 0) - used);
    value = `${remaining} / ${limit}`;
  }

  const low =
    !unavailable &&
    !unlimited &&
    typeof limit === "number" &&
    limit > 0 &&
    (limit - (storiesUsedThisMonth ?? 0)) / limit <= 0.2;

  return (
    <div
      title={`${label}: ${typeof value === "string" ? value : "Unlimited"}`}
      className={`inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1 text-xs font-bold shadow-soft transition-colors ${
        unlimited
          ? "border-amber-400/60 bg-gradient-to-r from-amber-100 to-yellow-50 text-amber-700 dark:from-amber-500/20 dark:to-yellow-500/10 dark:text-amber-300"
          : low
            ? "border-destructive/40 bg-destructive/10 text-destructive"
            : "border-primary/30 bg-primary/10 text-primary dark:bg-primary/20"
      }`}
      aria-label={`${label} ${typeof value === "string" ? value : "Unlimited"}`}
    >
      <Sparkles className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">{label}:</span>
      <span>{value}</span>
    </div>
  );
};

export default CreditCounter;
