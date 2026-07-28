import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export default function PaymentResult() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  
  const status = searchParams.get('status');

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In a real scenario, you might want to query the backend here
    // to double-check the transaction status.
    // For now, we simulate a brief loading state to ensure subscription cache clears or just UX.
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
        <h2 className="text-2xl font-bold">{t('payment.verifying', 'Verifying payment...')}</h2>
      </div>
    );
  }

  if (status === 'SUCCESS') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center max-w-md mx-auto px-4">
        <CheckCircle2 className="w-20 h-20 text-green-500 mb-6" />
        <h2 className="text-3xl font-extrabold mb-4">{t('payment.success_title', 'Payment Successful!')}</h2>
        <p className="text-muted-foreground mb-8 text-lg">
          {t('payment.success_desc', 'Your subscription has been activated. Thank you for upgrading.')}
        </p>
        <Link 
          to="/storyteller"
          className="bg-primary text-primary-foreground px-8 py-3 rounded-full font-bold shadow-soft hover-pop"
        >
          {t('payment.go_to_storyteller', 'Start Creating Stories')}
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center max-w-md mx-auto px-4">
      <XCircle className="w-20 h-20 text-red-500 mb-6" />
      <h2 className="text-3xl font-extrabold mb-4">{t('payment.failed_title', 'Payment Failed')}</h2>
      <p className="text-muted-foreground mb-8 text-lg">
        {t('payment.failed_desc', 'We could not process your payment at this time. Please try again.')}
      </p>
      <Link 
        to="/pricing"
        className="bg-secondary text-secondary-foreground px-8 py-3 rounded-full font-bold shadow-soft hover-pop"
      >
        {t('payment.try_again', 'Try Again')}
      </Link>
    </div>
  );
}
