/**
 * Real AIStoryteller render-path regression for the production crash
 * "TypeError: Cannot read properties of undefined (reading 'name')".
 *
 * This exercises the ACTUAL page: click Generate → mocked canonical
 * `POST /stories/plan` response → state update → React re-render → plan UI
 * stays mounted → approve reaches the compose call (POST /stories) with the
 * same canonical child UUID.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

const CHILD_UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

const mocks = vi.hoisted(() => ({
  planSelStory: vi.fn(),
  composeSelStory: vi.fn(),
  resolveActiveChild: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, d?: string) => d ?? k,
    i18n: { language: "en" },
  }),
  Trans: ({ children }: { children?: unknown }) => children ?? null,
}));

vi.mock("@/integrations/supabase/client", () => {
  // Fully chainable stub so page-level effects (voice lists, etc.) resolve.
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit", "in", "neq", "is"]) {
    chain[m] = vi.fn(() => chain);
  }
  chain.maybeSingle = vi.fn(async () => ({ data: null, error: null }));
  chain.single = vi.fn(async () => ({ data: null, error: null }));
  chain.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(res);
  return {
    supabase: {
      functions: { invoke: vi.fn() },
      from: vi.fn(() => chain),
      auth: {
        getSession: vi.fn(async () => ({ data: { session: null } })),
        getUser: vi.fn(async () => ({ data: { user: null } })),
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

/** Canonical Backend Core V6R3 plan response variants. */
const planWith = (characters: unknown[]) => ({
  title: "Omar and the Lost Sky Crystal",
  characters,
  conflict: "The crystal protecting the Sky Kingdom is missing.",
  resolution: "Omar restores the crystal.",
  selGoals: ["Courage"],
  pageCount: 11,
});

const HERO = { name: "Omar", role: "hero", description: "A brave child" };
const COMPANION = { name: "Lumi", role: "companion", description: "A blue dragon" };

const renderPage = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/ai-storyteller"]}>
        <AIStoryteller />
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe("AIStoryteller — canonical plan render path (production crash regression)", () => {
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

  it.each([
    ["hero + companion", [HERO, COMPANION]],
    ["hero only", [HERO]],
    ["empty characters", []],
  ])(
    "renders the plan preview after Generate without any undefined.name crash (%s)",
    async (_label, characters) => {
      const raw = planWith(characters);
      mocks.planSelStory.mockImplementation(async (input: { childName?: string }) => ({
        requestId: "req-1",
        mode: "plan" as const,
        blueprint: normalizePlanBlueprint(raw, input?.childName ?? ""),
        age_band: "6-8" as const,
      }));
      mocks.composeSelStory.mockResolvedValue({
        story_id: "s1",
        title: raw.title,
        pages: [{ index: 1, text: "Once...", emotionTag: "", illustrationPrompt: "" }],
        sel_outcome: { skill: "", emotion: "", statement: "" },
        character_visual_hash: "",
        age_band: "6-8",
        quality: { total: 20, passed: true, scores: {} },
        safety: { passed: true, violations: [] },
        length: { passed: true, pageCount: 1 },
        passed: true,
        regeneration_count: 0,
      });

      renderPage();

      // The page prefills a custom brief from the active child, which routes
      // the click through plan → preview (the production crash path).
      const generate = await screen.findByText("ai.generate");
      fireEvent.click(generate);

      await waitFor(() => expect(mocks.planSelStory).toHaveBeenCalledTimes(1));

      // Preview stays mounted (no ErrorBoundary / crash) and the user can continue.
      const approve = await screen.findByRole("button", { name: /Write the story/i });
      expect(screen.getByText(raw.title)).toBeTruthy();

      fireEvent.click(approve);
      await waitFor(() => expect(mocks.composeSelStory).toHaveBeenCalledTimes(1));
      // plan and create receive the same canonical child UUID.
      expect(mocks.planSelStory.mock.calls[0][0].childProfileId).toBe(CHILD_UUID);
      expect(mocks.composeSelStory.mock.calls[0][0].childProfileId).toBe(CHILD_UUID);
    },
  );
});
