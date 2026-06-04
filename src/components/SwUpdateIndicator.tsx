import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { subscribeSwUpdate, applyPendingSwUpdate } from "@/pwa/swUpdate";

export default function SwUpdateIndicator() {
  const { t } = useTranslation();
  const [pending, setPending] = useState(false);

  useEffect(() => subscribeSwUpdate(setPending), []);

  if (!pending) return null;

  return (
    <button
      onClick={() => applyPendingSwUpdate()}
      className="fixed bottom-36 md:bottom-20 end-4 z-[55] inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-4 py-2 text-xs font-bold shadow-lg hover:opacity-90"
      title={t(
        "pwa.update_pending_hint",
        "سيتم التحديث تلقائياً بعد انتهاء القصة",
      )}
    >
      <RefreshCw className="h-3.5 w-3.5" />
      {t("pwa.update_now", "تحديث متاح")}
    </button>
  );
}
