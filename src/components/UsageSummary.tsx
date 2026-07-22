import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

const fetchUsageSummary = async (token: string) => {
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/v2/users/me/usage`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error("Failed to fetch usage");
  return res.json();
};

export const UsageSummary = () => {
  const { session } = useAuth();
  const { limits, plan } = useSubscription();
  const { t, i18n } = useTranslation();
  const isAr = i18n.language?.startsWith('ar');

  const { data: usage, isLoading, error } = useQuery({
    queryKey: ["usage-summary", session?.access_token],
    queryFn: () => fetchUsageSummary(session?.access_token!),
    enabled: !!session?.access_token
  });

  if (isLoading) {
    return <div className="p-4 flex justify-center"><Loader2 className="animate-spin h-5 w-5 text-primary" /></div>;
  }

  if (error || !usage) {
    return null;
  }

  const limitStories = limits?.['STORIES_PER_MONTH'];
  const limitIllustrations = limits?.['ILLUSTRATIONS_PER_MONTH'];
  const limitPdfs = limits?.['PDF_EXPORTS_PER_MONTH'];

  return (
    <div className="p-3 text-sm">
      <div className="font-bold text-xs uppercase tracking-wide opacity-60 mb-2">
        {isAr ? "استخدامك هذا الشهر" : "Usage This Month"} - {plan}
      </div>
      
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span>{isAr ? "القصص" : "Stories"}:</span>
          <span className="font-semibold">{usage.storiesCreated} / {limitStories === null ? '∞' : limitStories || 0}</span>
        </div>
        
        {(limitIllustrations !== null && limitIllustrations !== undefined && limitIllustrations > 0) || usage.illustrationsGenerated > 0 ? (
          <div className="flex justify-between items-center">
            <span>{isAr ? "الرسومات" : "Illustrations"}:</span>
            <span className="font-semibold">{usage.illustrationsGenerated} / {limitIllustrations === null ? '∞' : limitIllustrations || 0}</span>
          </div>
        ) : null}

        {(limitPdfs !== null && limitPdfs !== undefined && limitPdfs > 0) || usage.pdfExports > 0 ? (
          <div className="flex justify-between items-center">
            <span>{isAr ? "تصدير PDF" : "PDF Exports"}:</span>
            <span className="font-semibold">{usage.pdfExports} / {limitPdfs === null ? '∞' : limitPdfs || 0}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default UsageSummary;
