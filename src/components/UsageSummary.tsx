import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { getLocalized } from "@/lib/multilingual";

/**
 * Compact monthly usage summary. Reads everything from the subscription
 * state (Lovable Cloud) — no external API server involved.
 */
export const UsageSummary = () => {
  const { user } = useAuth();
  const { plan, tier, loading, storiesUsedThisMonth } = useSubscription();
  const { i18n } = useTranslation();
  const isAr = i18n.language?.startsWith("ar");

  if (!user) return null;

  if (loading) {
    return (
      <div className="p-4 flex justify-center">
        <Loader2 className="animate-spin h-5 w-5 text-primary" />
      </div>
    );
  }

  const limitStories = plan?.monthly_story_limit ?? null;

  return (
    <div className="p-3 text-sm">
      <div className="font-bold text-xs uppercase tracking-wide opacity-60 mb-2">
        {isAr ? "استخدامك هذا الشهر" : "Usage This Month"} - {getLocalized(plan?.name, i18n.language) || tier}
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span>{isAr ? "القصص" : "Stories"}:</span>
          <span className="font-semibold">
            {storiesUsedThisMonth} / {limitStories === null ? "∞" : limitStories}
          </span>
        </div>
      </div>
    </div>
  );
};

export default UsageSummary;
