import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useSubscription } from "./useSubscription";

const BYOK_ELIGIBLE_TIERS = new Set(["pro_creator", "elite_publisher"]);

export interface ByokStatus {
  loading: boolean;
  /** User has at least one enabled, validation_status="valid" key (openai/openrouter). */
  hasValidPersonalKey: boolean;
  /** Current plan tier is BYOK-eligible. */
  tierEligible: boolean;
  /** True ⇒ user may generate even with 0 monthly credits. */
  bypass: boolean;
}

/** Reads safe metadata only — never plaintext or ciphertext. */
export function useByokStatus(): ByokStatus {
  const { user } = useAuth();
  const sub = useSubscription();

  const q = useQuery({
    queryKey: ["byok-status", user?.id],
    enabled: !!user,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_api_keys")
        .select("provider, enabled, validation_status")
        .eq("user_id", user!.id)
        .in("provider", ["openai", "openrouter"]);
      if (error) throw error;
      return (data ?? []).some(
        (r: { enabled: boolean; validation_status: string | null }) =>
          r.enabled && r.validation_status === "valid",
      );
    },
  });

  const tierEligible = BYOK_ELIGIBLE_TIERS.has(String(sub.tier));
  const hasValidPersonalKey = !!q.data;
  return {
    loading: sub.loading || (!!user && q.isLoading),
    hasValidPersonalKey,
    tierEligible,
    bypass: tierEligible && hasValidPersonalKey,
  };
}
