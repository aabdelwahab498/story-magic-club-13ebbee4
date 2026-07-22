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
    queryFn: async () => {
      if (!user) return { balance: 0 };

      // Make a GET request to the backend endpoint using supabase functions or direct fetch
      // But we built the endpoint at /api/v2/users/me/credits in NestJS.
      // Wait, is there a global axios client? I'll use standard fetch with the session token.
      
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("No access token available");
      }

      // Assuming backend runs at same origin + /api/v2 or similar. Let's look at environment vars or fallback.
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000/api/v2';
      
      const response = await fetch(`${backendUrl}/users/me/credits`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch credits');
      }

      const result: CreditsResponse = await response.json();
      return result;
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
