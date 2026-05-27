import { useTranslation } from "react-i18next";
import { CheckCircle2, Sparkles, BookOpen, Gift } from "lucide-react";

interface PaymentSuccessProps {
  itemName: string;
  onContinue: () => void;
  onSpinReward: () => void;
}

const PaymentSuccess = ({ itemName, onContinue, onSpinReward }: PaymentSuccessProps) => {
  const { t } = useTranslation();
  return (
    <div className="text-center py-2">
      <div className="relative mx-auto h-20 w-20 mb-4">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 animate-pulse opacity-40" />
        <div className="relative h-full w-full rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-glow">
          <CheckCircle2 className="h-10 w-10 text-white" />
        </div>
      </div>
      <h3 className="text-2xl font-extrabold text-foreground mb-1">
        {t("payment.success.title")}
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        {t("payment.success.desc", { item: itemName })}
      </p>

      <div className="bg-gradient-to-br from-kids-softYellow/60 to-kids-softPurple/40 dark:from-card/80 dark:to-card/60 rounded-2xl p-4 border-2 border-white/60 mb-4 text-start">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <span className="font-bold text-foreground text-sm">{t("payment.success.unlocked")}</span>
        </div>
        <ul className="space-y-1.5 text-sm text-foreground">
          <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> {t("pricing.features.unlimited_stories")}</li>
          <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> {t("pricing.features.ai_generation")}</li>
          <li className="flex items-center gap-2"><span className="text-emerald-500">✓</span> {t("pricing.features.audio_playback")}</li>
        </ul>
      </div>

      <button
        onClick={onSpinReward}
        className="w-full mb-2 px-4 py-3 bg-sunset text-kids-midnight rounded-full font-bold hover-pop shadow-pop inline-flex items-center justify-center gap-2"
      >
        <Gift className="h-4 w-4" />
        {t("payment.success.spin_reward")}
      </button>
      <button
        onClick={onContinue}
        className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-full font-bold hover-pop shadow-soft inline-flex items-center justify-center gap-2"
      >
        <BookOpen className="h-4 w-4" />
        {t("payment.success.start_reading")}
      </button>
    </div>
  );
};

export default PaymentSuccess;
