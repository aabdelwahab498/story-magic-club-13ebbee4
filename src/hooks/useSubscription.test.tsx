import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, ReactNode } from "react";
import { useSubscription } from "./useSubscription";

let mockIsAdmin = false;
let mockUser: { id: string } | null = { id: "u1" };

vi.mock("./useAuth", () => ({
  useAuth: () => ({ user: mockUser, isAdmin: mockIsAdmin }),
}));

vi.mock("./useAdminTrialOverrides", () => ({
  useAdminTrialOverrides: () => ({
    overrides: { createStory: false, illustrations: false, pdf: false, audio: false },
  }),
}));

vi.mock("@/lib/subscriptionApi", () => ({
  fetchPlans: vi.fn().mockResolvedValue([
    {
      tier: "free",
      name: { en: "Free" },
      monthly_story_limit: 1,
      allow_illustrations: true,
      allow_pdf: true,
      allow_audio: true,
    },
  ]),
  fetchActiveSubscription: vi.fn().mockResolvedValue({ plan_tier: "free", expires_at: null }),
  countStoriesThisMonth: vi.fn().mockResolvedValue(5),
}));

const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(QueryClientProvider, {
    client: new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  }, children);

describe("useSubscription admin story quota bypass", () => {
  beforeEach(() => {
    mockIsAdmin = false;
    mockUser = { id: "u1" };
  });

  it("free user over the monthly limit stays blocked", async () => {
    const { result } = renderHook(() => useSubscription(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tier).toBe("free");
    expect(result.current.storiesUsedThisMonth).toBe(5);
    expect(result.current.remainingStories).toBe(0);
    expect(result.current.canCreateStory).toBe(false);
  });

  it("admin gets canCreateStory=true and remainingStories=Infinity", async () => {
    mockIsAdmin = true;
    const { result } = renderHook(() => useSubscription(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tier).toBe("free"); // plan tier unchanged
    expect(result.current.canCreateStory).toBe(true);
    expect(result.current.remainingStories).toBe(Number.POSITIVE_INFINITY);
  });
});
