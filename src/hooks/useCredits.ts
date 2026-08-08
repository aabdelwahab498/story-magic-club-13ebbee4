import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface CreditsResponse {
  balance: number;
}

export function useCredits() {
  const { user } = useAuth();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['user-credits', user?.id],
    queryFn: async (): Promise<CreditsResponse> => {
      if (!user) return { balance: 0 };
      // Source of truth: `illustration_credits` (RLS-scoped to the signed-in user).
      const { data: row, error: err } = await supabase
        .from('illustration_credits')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();
      if (err) throw err;
      return { balance: row?.balance ?? 0 };
    },
    enabled: !!user,
  });


  return {
    balance: data?.balance ?? 0,
    isLoading,
    error,
    refetch
  };
}
