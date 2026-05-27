import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";
import { useAdminTrialOverrides } from "./useAdminTrialOverrides";
import {
  fetchActiveSubscription,
  fetchPlans,
  countStoriesThisMonth,
  type PlanTier,
  type SubscriptionPlan,
} from "@/lib/subscriptionApi";

export interface SubscriptionState {
  loading: boolean;
  tier: PlanTier;
  plan: SubscriptionPlan | null;
  expiresAt: string | null;
  storiesUsedThisMonth: number;
  remainingStories: number;
  canIllustrate: boolean;
  canExportPdf: boolean;
  canAudio: boolean;
  canCreateStory: boolean;
}

export function useSubscription(): SubscriptionState {
  const { user, isAdmin } = useAuth();
  const { overrides } = useAdminTrialOverrides();

  const plansQ = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: fetchPlans,
    staleTime: 5 * 60_000,
  });

  const subQ = useQuery({
    queryKey: ["active-sub", user?.id],
    queryFn: () => (user ? fetchActiveSubscription(user.id) : Promise.resolve(null)),
    enabled: !!user,
  });

  const usageQ = useQuery({
    queryKey: ["story-usage", user?.id],
    queryFn: () => (user ? countStoriesThisMonth(user.id) : Promise.resolve(0)),
    enabled: !!user,
    staleTime: 30_000,
  });

  const tier: PlanTier = (subQ.data?.plan_tier as PlanTier) ?? "free";
  const plan = plansQ.data?.find((p) => p.tier === tier) ?? null;
  const used = usageQ.data ?? 0;
  const limit = plan?.monthly_story_limit ?? 5;
  const remaining = Math.max(0, limit - used);

  return {
    loading: plansQ.isLoading || (!!user && subQ.isLoading),
    tier,
    plan,
    expiresAt: subQ.data?.expires_at ?? null,
    storiesUsedThisMonth: used,
    remainingStories: isAdmin && overrides.createStory ? Number.POSITIVE_INFINITY : remaining,
    canIllustrate: (isAdmin && overrides.illustrations) || !!plan?.allow_illustrations,
    canExportPdf: (isAdmin && overrides.pdf) || !!plan?.allow_pdf,
    canAudio: (isAdmin && overrides.audio) || !!plan?.allow_audio,
    canCreateStory: (isAdmin && overrides.createStory) || remaining > 0,
  };
}
