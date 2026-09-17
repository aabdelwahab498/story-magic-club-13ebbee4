/**
 * Frontend contract for the controlled, retryable provider outage
 * (HTTP 503 + AI_PROVIDER_TEMPORARILY_UNAVAILABLE).
 *
 * The page must stay mounted, keep the selected child / prompt / settings and
 * offer a single manual retry — with no automatic browser re-requests.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ApiError, isProviderTemporarilyUnavailable } from "@/api/errors";

const CHILD_UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

const mocks = vi.hoisted(() => ({
  planSelStory: vi.fn(),
  composeSelStory: vi.fn(),
  resolveActiveChild: vi.fn(),
  navigate: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, d?: string) => d ?? k,
    i18n: { language: "en" },
  }),
  Trans: ({ children }: { children?: unknown }) => children ?? null,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mocks.navigate };
});

vi.mock("@/integrations/supabase/client", () => {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit", "in", "neq", "is"]) {
    chain[m] = vi.fn(() => chain);
  }
  chain.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  chain.single = vi.fn(async () => ({ data: null, error: null }));
  chain.then = (res: (v: unknown) => unknown) =>
    Promise.resolve({ data: [], error: null }).then(res);
  return {
    supabase: {
      functions: { invoke: vi.fn() },
      from: vi.fn(() => chain),
      auth: {
        getSession: vi.fn(async () => ({ data: { session: null } })),
        getUser: vi.fn(async () => ({ data: { user: null } })),
        signOut: vi.fn(async () => ({ error: null })),
      },
    },
  };
});

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1" }, session: null, isAdmin: false }),
}));
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({
    loading: false,
    tier: "free",
    plan: { monthly_story_limit: 10, name: { en: "Free" } },
    storiesUsedThisMonth: 0,
    canExportPdf: true,
  }),
}));
vi.mock("@/hooks/useByokStatus", () => ({
  useByokStatus: () => ({ bypass: false, loading: false }),
}));
vi.mock("@/lib/childProfilesApi", () => ({
  useActiveChild: () => ({
    active: { id: CHILD_UUID, name: "Layla", age: 8, emotionalGoals: [] },
    children: [],
    isLoading: false,
  }),
  resolveActiveChild: (...a: unknown[]) => mocks.resolveActiveChild(...a),
  useActiveChildId: () => CHILD_UUID,
}));
vi.mock("@/lib/selStoryApi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/selStoryApi")>();
  return {
    ...actual,
    planSelStory: (...a: unknown[]) => mocks.planSelStory(...a),
    composeSelStory: (...a: unknown[]) => mocks.composeSelStory(...a),
  };
});

import AIStoryteller from "./AIStoryteller";
import { normalizePlanBlueprint } from "@/lib/selStoryApi";

const providerUnavailable = () =>
  new ApiError(503, "The story service is temporarily busy. Please try again shortly.", {
    success: false,
    code: "AI_PROVIDER_TEMPORARILY_UNAVAILABLE",
    message: "The story service is temporarily busy. Please try again shortly.",
    retryable: true,
  });

const renderPage = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter initialEntries={["/ai-storyteller"]}>
        <AIStoryteller />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("controlled provider-unavailable detection", () => {
  it("recognises the canonical 503 contract", () => {
    expect(isProviderTemporarilyUnavailable(providerUnavailable())).toBe(true);
  });

  it("does not treat other failures as temporary", () => {
    expect(isProviderTemporarilyUnavailable(new ApiError(500, "Internal server error"))).toBe(false);
    expect(isProviderTemporarilyUnavailable(new ApiError(401, "Unauthorized"))).toBe(false);
    expect(isProviderTemporarilyUnavailable(null)).toBe(false);
  });
});

describe("AIStoryteller — temporary AI provider outage (HTTP 503)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveActiveChild.mockResolvedValue({
      id: CHILD_UUID,
      name: "Layla",
      age: 8,
      emotionalGoals: [],
    });
    localStorage.clear();
  });

  it("stays mounted, preserves the form and keeps one manual retry available", async () => {
    mocks.planSelStory.mockRejectedValue(providerUnavailable());

    renderPage();

    const generate = await screen.findByText("ai.generate");
    fireEvent.click(generate);

    await waitFor(() => expect(mocks.planSelStory).toHaveBeenCalledTimes(1));

    // Temporary-service message shown, page still mounted, no navigation away.
    await screen.findByText(/temporarily busy/i);
    expect(screen.getByText("ai.generate")).toBeTruthy();
    expect(mocks.navigate).not.toHaveBeenCalled();

    // No automatic browser retry: the request count stays at 1 until the user acts.
    await new Promise((r) => setTimeout(r, 50));
    expect(mocks.planSelStory).toHaveBeenCalledTimes(1);

    // Selected child and prompt survive: a manual retry re-sends the same payload.
    const firstPayload = mocks.planSelStory.mock.calls[0][0];
    expect(firstPayload.childProfileId).toBe(CHILD_UUID);

    // J. retry succeeds once the provider recovers → normal plan flow continues.
    mocks.planSelStory.mockImplementation(async (input: { childName?: string }) => ({
      requestId: "req-1",
      mode: "plan" as const,
      blueprint: normalizePlanBlueprint(
        {
          title: "Layla and the Lost Sparkle Stone",
          characters: [{ name: "Layla", role: "hero", description: "brave" }],
          conflict: "c",
          resolution: "r",
          selGoals: ["Courage"],
          pageCount: 11,
        },
        input?.childName ?? "",
      ),
      age_band: "6-8" as const,
    }));

    fireEvent.click(screen.getByText("ai.generate"));
    await waitFor(() => expect(mocks.planSelStory).toHaveBeenCalledTimes(2));
    expect(mocks.planSelStory.mock.calls[1][0].childProfileId).toBe(CHILD_UUID);
    expect(mocks.planSelStory.mock.calls[1][0].customPrompt).toBe(firstPayload.customPrompt);
    await screen.findByText("Layla and the Lost Sparkle Stone");
  });
});
