import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export function useUpgrade() {
  const { session } = useAuth();
  const [isUpgrading, setIsUpgrading] = useState(false);

  const startUpgrade = async (planId: string) => {
    if (!session?.access_token) {
      toast.error('You must be logged in to upgrade');
      return;
    }

    try {
      setIsUpgrading(true);
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api/v2/billing/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ planId }),
      });

      if (!res.ok) {
        throw new Error('Failed to create checkout session');
      }

      const data = await res.json();
      
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error('Invalid checkout response');
      }
    } catch (error: any) {
      toast.error(error.message || 'An error occurred while upgrading');
    } finally {
      setIsUpgrading(false);
    }
  };

  return { startUpgrade, isUpgrading };
}
