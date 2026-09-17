/**
 * Real AIStoryteller resilience regression: recoverable failures must never
 * crash the route, reset the form, or expose raw technical errors.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "@/api/errors";

const CHILD_UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

const mocks = vi.hoisted(() => ({
  planSelStory: vi.fn(),
  composeSelStory: vi.fn(),
  resolveActiveChild: vi.fn(),
  navigate: vi.fn(),
  signOut: vi.fn(async () => ({ error: null })),
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
        signOut: mocks.signOut,
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
import SectionErrorBoundary from "@/components/SectionErrorBoundary";

const canonicalPlan = (characters: Array<Record<string, string>>) => ({
  requestId: "req-1",
  mode: "plan" as const,
  blueprint: normalizePlanBlueprint(
    {
      title: "Layla and the Lost Sparkle Stone",
      characters,
      conflict: "c",
      resolution: "r",
      selGoals: ["Courage", "Friendship"],
      pageCount: 11,
    },
    "Layla",
  ),
  age_band: "6-8" as const,
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

describe("AIStoryteller resilience", () => {
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

  // A / E: happy path with hero + companion.
  it("renders the plan preview for a canonical hero + companion plan", async () => {
    mocks.planSelStory.mockResolvedValue(
      canonicalPlan([
        { name: "Layla", role: "hero", description: "brave" },
        { name: "Lumi", role: "companion", description: "glowing firefly" },
      ]),
    );
    renderPage();
    fireEvent.click(await screen.findByText("ai.generate"));
    await screen.findByText("Layla and the Lost Sparkle Stone");
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  // F: hero only.
  it("renders a hero-only plan without crashing", async () => {
    mocks.planSelStory.mockResolvedValue(
      canonicalPlan([{ name: "Layla", role: "hero", description: "brave" }]),
    );
    renderPage();
    fireEvent.click(await screen.findByText("ai.generate"));
    await screen.findByText("Layla and the Lost Sparkle Stone");
  });

  // G: empty characters → safe state, route still mounted.
  it("keeps the route mounted when the plan has no characters", async () => {
    mocks.planSelStory.mockResolvedValue(canonicalPlan([]));
    renderPage();
    fireEvent.click(await screen.findByText("ai.generate"));
    await screen.findByText("Layla and the Lost Sparkle Stone");
    expect(screen.queryByText(/Cannot read properties/i)).toBeNull();
  });

  // D: repeated clicks while a request is in flight → exactly one request.
  it("sends exactly one request when Generate is clicked repeatedly", async () => {
    let release: (v: unknown) => void = () => {};
    mocks.planSelStory.mockImplementation(
      () => new Promise((r) => { release = r; }),
    );
    renderPage();
    const btn = await screen.findByText("ai.generate");
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => expect(mocks.planSelStory).toHaveBeenCalledTimes(1));
    release(canonicalPlan([{ name: "Layla", role: "hero", description: "brave" }]));
    await screen.findByText("Layla and the Lost Sparkle Stone");
    expect(mocks.planSelStory).toHaveBeenCalledTimes(1);
  });

  // K: network failure → friendly message, form preserved, recoverable.
  it("survives a network failure and keeps the form usable", async () => {
    mocks.planSelStory.mockRejectedValue(
      Object.assign(new Error("Network Error"), { code: "ERR_NETWORK" }),
    );
    renderPage();
    fireEvent.click(await screen.findByText("ai.generate"));
    await waitFor(() => expect(mocks.planSelStory).toHaveBeenCalledTimes(1));
    await screen.findByText(/couldn't reach|connection/i);
    expect(screen.getByText("ai.generate")).toBeTruthy();
    expect(mocks.navigate).not.toHaveBeenCalled();
    expect(mocks.planSelStory.mock.calls[0][0].childProfileId).toBe(CHILD_UUID);
  });

  // I: story quota exhausted → no crash, no retryable framing.
  it("shows a controlled message when the story quota is exhausted", async () => {
    mocks.planSelStory.mockRejectedValue(
      new ApiError(403, "limit", { code: "story_limit_reached" }),
    );
    renderPage();
    fireEvent.click(await screen.findByText("ai.generate"));
    await screen.findByText(/story limit reached/i);
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  // J: illustration credits exhausted.
  it("shows a controlled message when illustration credits are exhausted", async () => {
    mocks.planSelStory.mockRejectedValue(
      new ApiError(402, "credits", { code: "illustration_credits_exhausted" }),
    );
    renderPage();
    fireEvent.click(await screen.findByText("ai.generate"));
    await screen.findByText(/illustration credits/i);
  });

  // H: 401 is auth handling, not a generic generation failure.
  it("routes an expired session to sign-in instead of showing a generation error", async () => {
    mocks.planSelStory.mockRejectedValue(new ApiError(401, "Unauthorized"));
    renderPage();
    fireEvent.click(await screen.findByText("ai.generate"));
    await waitFor(() => expect(mocks.navigate).toHaveBeenCalled());
    expect(mocks.navigate.mock.calls[0][0]).toBe("/auth");
  });
});

// L / M / N / O: a malformed section degrades locally, route stays alive.
describe("SectionErrorBoundary", () => {
  it("degrades only its own section", () => {
    const Boom = () => {
      throw new Error("bad optional field");
    };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <div>
        <p>story stays readable</p>
        <SectionErrorBoundary sectionLabel="Pictures unavailable" hint="Story is safe">
          <Boom />
        </SectionErrorBoundary>
      </div>,
    );
    expect(screen.getByText("story stays readable")).toBeTruthy();
    expect(screen.getByText("Pictures unavailable")).toBeTruthy();
    expect(screen.getByText("Story is safe")).toBeTruthy();
    spy.mockRestore();
  });
});
