import { renderHook } from "@testing-library/react";
import { useSubscription } from "./useSubscription";
import { useAuth } from "./useAuth";
import { useQuery } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("./useAdminTrialOverrides", () => ({
  useAdminTrialOverrides: vi.fn().mockReturnValue({
    overrides: { createStory: false, illustrations: false, pdf: false, audio: false },
  }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
}));

vi.mock("@/lib/subscriptionApi", () => ({
  fetchActiveSubscription: vi.fn(),
  fetchPlans: vi.fn(),
  countStoriesThisMonth: vi.fn(),
}));

describe("useSubscription story quota bypass", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should bypass story quota for admin user even when free tier limit reached", () => {
    (useAuth as any).mockReturnValue({
      user: { id: "admin-1" },
      isAdmin: true,
      hasRole: (r: string) => r === "admin",
    });

    (useQuery as any).mockImplementation(({ queryKey }: { queryKey: string[] }) => {
      if (queryKey[0] === "subscription-plans") {
        return { data: [{ tier: "free", monthly_story_limit: 1 }] };
      }
      if (queryKey[0] === "active-sub") {
        return { data: { plan_tier: "free" } };
      }
      if (queryKey[0] === "story-usage") {
        return { data: 5 }; // Exhausted limit (5 >= 1)
      }
      return { data: null };
    });

    const { result } = renderHook(() => useSubscription());

    expect(result.current.remainingStories).toBe(Number.POSITIVE_INFINITY);
    expect(result.current.canCreateStory).toBe(true);
    expect(result.current.canIllustrate).toBe(true);
  });

  it("should enforce story quota limit for normal free user when exhausted", () => {
    (useAuth as any).mockReturnValue({
      user: { id: "user-1" },
      isAdmin: false,
      hasRole: () => false,
    });

    (useQuery as any).mockImplementation(({ queryKey }: { queryKey: string[] }) => {
      if (queryKey[0] === "subscription-plans") {
        return { data: [{ tier: "free", monthly_story_limit: 1 }] };
      }
      if (queryKey[0] === "active-sub") {
        return { data: { plan_tier: "free" } };
      }
      if (queryKey[0] === "story-usage") {
        return { data: 1 }; // Exhausted limit (1 >= 1)
      }
      return { data: null };
    });

    const { result } = renderHook(() => useSubscription());

    expect(result.current.remainingStories).toBe(0);
    expect(result.current.canCreateStory).toBe(false);
  });

  it("should allow story creation for normal free user under quota", () => {
    (useAuth as any).mockReturnValue({
      user: { id: "user-2" },
      isAdmin: false,
      hasRole: () => false,
    });

    (useQuery as any).mockImplementation(({ queryKey }: { queryKey: string[] }) => {
      if (queryKey[0] === "subscription-plans") {
        return { data: [{ tier: "free", monthly_story_limit: 5 }] };
      }
      if (queryKey[0] === "active-sub") {
        return { data: { plan_tier: "free" } };
      }
      if (queryKey[0] === "story-usage") {
        return { data: 2 };
      }
      return { data: null };
    });

    const { result } = renderHook(() => useSubscription());

    expect(result.current.remainingStories).toBe(3);
    expect(result.current.canCreateStory).toBe(true);
  });
});
