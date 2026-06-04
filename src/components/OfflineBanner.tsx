import { useEffect, useState } from "react";
import { WifiOff, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export default function OfflineBanner() {
  const online = useOnlineStatus();
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (online) setDismissed(false);
  }, [online]);

  if (online || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-0 inset-x-0 z-[60] bg-amber-500 text-amber-950 shadow-lg"
    >
      <div className="max-w-5xl mx-auto px-4 py-2 flex items-start gap-3 text-sm">
        <WifiOff className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
        <div className="flex-1">
          <p className="font-bold">
            {t("offline.title", "أنت غير متصل بالإنترنت")}
          </p>
          <p className="opacity-90">
            {t(
              "offline.description",
              "يمكنك تصفّح القصص والصور والصوت التي زرتها سابقاً. الميزات التي تحتاج اتصالاً (توليد قصة جديدة، تسجيل الدخول، الدفع) ستعود عند رجوع الاتصال.",
            )}
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Close"
          className="p-1 rounded hover:bg-amber-600/30"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
