import { useTranslation } from "react-i18next";
import { XCircle, RotateCw } from "lucide-react";

interface PaymentErrorProps {
  onRetry: () => void;
  onCancel: () => void;
}

const PaymentError = ({ onRetry, onCancel }: PaymentErrorProps) => {
  const { t } = useTranslation();
  return (
    <div className="text-center py-2">
      <div className="mx-auto h-20 w-20 mb-4 rounded-full bg-gradient-to-br from-rose-400 to-red-500 flex items-center justify-center shadow-glow">
        <XCircle className="h-10 w-10 text-white" />
      </div>
      <h3 className="text-2xl font-extrabold text-foreground mb-1">
        {t("payment.error.title")}
      </h3>
      <p className="text-sm text-muted-foreground mb-5">
        {t("payment.error.desc")}
      </p>
      <button
        onClick={onRetry}
        className="w-full mb-2 px-4 py-3 bg-primary text-primary-foreground rounded-full font-bold hover-pop shadow-soft inline-flex items-center justify-center gap-2"
      >
        <RotateCw className="h-4 w-4" />
        {t("payment.error.retry")}
      </button>
      <button
        onClick={onCancel}
        className="w-full px-4 py-2.5 bg-transparent border-2 border-muted-foreground/30 text-foreground rounded-full font-bold hover:bg-muted/40 transition-colors"
      >
        {t("payment.error.cancel")}
      </button>
    </div>
  );
};

export default PaymentError;
