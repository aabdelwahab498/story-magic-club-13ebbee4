/**
 * Custom story brief preservation regression.
 *
 * Bug: the active-child prefill effect called setCustomPrompt("Hero name: …")
 * whenever the child resolved/changed, silently overwriting a brief the user
 * had already typed. A user-authored prompt must survive child resolution and
 * child metadata changes; child identity travels via childId /
 * preferences.childName / preferences.age — never via the prompt.
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
  activeChild: { current: null as null | Record<string, unknown> },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, d?: string) => d ?? k,
    i18n: { language: "en" },
  }),
  Trans: ({ children }: { children?: unknown }) => children ?? null,
}));

vi.mock("@/integrations/supabase/client", () => {
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
    active: mocks.activeChild.current,
    children: mocks.activeChild.current ? [mocks.activeChild.current] : [],
    isLoading: false,
  }),
  resolveActiveChild: (...a: unknown[]) => mocks.resolveActiveChild(...a),
  useActiveChildId: () => (mocks.activeChild.current?.id as string) ?? null,
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
import { toCreateStoryRequest } from "@/lib/selStoryApi";

const USER_BRIEF =
  "Omar discovers a tiny glowing star in his garden and helps it return to the sky.";

const OMAR = { id: CHILD_UUID, name: "Omar", age: 7, emotionalGoals: ["courage"] };

const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const pageJsx = (
  <QueryClientProvider client={qc}>
    <MemoryRouter initialEntries={["/ai-storyteller"]}>
      <AIStoryteller />
    </MemoryRouter>
  </QueryClientProvider>
);
const renderPage = () => render(pageJsx);

const getPromptBox = async () =>
  (await screen.findAllByRole("textbox")).find(
    (el) => el.tagName === "TEXTAREA",
  ) as HTMLTextAreaElement;

describe("AIStoryteller — user-authored custom prompt is never clobbered", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.activeChild.current = null;
    mocks.resolveActiveChild.mockImplementation(async () => mocks.activeChild.current);
    localStorage.clear();
    mocks.planSelStory.mockResolvedValue({
      requestId: "req-1",
      mode: "plan" as const,
      blueprint: {
        title: "T",
        hero: { name: "Omar", age: 7 },
        acts: {},
        selOutcome: { skill: "", emotion: "", statement: "" },
        characterVisualHash: "",
      },
      age_band: "6-8" as const,
    });
    mocks.composeSelStory.mockResolvedValue({
      story_id: "s1",
      title: "T",
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
  });

  it("CASE A: a typed brief survives child resolution", async () => {
    const { rerender } = renderPage();
    const box = await getPromptBox();
    fireEvent.change(box, { target: { value: USER_BRIEF } });

    // Child profile resolves AFTER the user typed.
    mocks.activeChild.current = OMAR;
    rerender(pageJsx);

    expect((await getPromptBox()).value).toBe(USER_BRIEF);
  });

  it("CASE B: a typed brief survives a child switch while metadata updates", async () => {
    mocks.activeChild.current = OMAR;
    const { rerender } = renderPage();
    const box = await getPromptBox();
    // The user replaces the prefill with their own brief.
    fireEvent.change(box, { target: { value: USER_BRIEF } });

    // Switch to a different child and re-render: metadata updates,
    // the brief must not.
    mocks.activeChild.current = { id: "11111111-1111-1111-1111-111111111111", name: "Lina", age: 5, emotionalGoals: ["kindness"] };
    rerender(pageJsx);

    expect((await getPromptBox()).value).toBe(USER_BRIEF);
  });

  it("CASE C: an empty prompt still names the active child as protagonist", () => {
    const dto = toCreateStoryRequest({
      childProfileId: CHILD_UUID,
      childName: "Omar",
      age: 7,
      theme: "Adventure",
      language: "en",
    });
    expect(dto.childId).toBe(CHILD_UUID);
    expect(dto.preferences?.customPrompt).toContain("The main character is Omar");
    expect(JSON.stringify(dto)).not.toContain("Hero name");
  });

  it("CASE D + E: plan and create payloads carry the unchanged brief via preferences.customPrompt", async () => {
    mocks.activeChild.current = OMAR;
    mocks.resolveActiveChild.mockResolvedValue(OMAR);
    renderPage();

    const box = (await screen.findAllByRole("textbox")).find(
      (el) => el.tagName === "TEXTAREA",
    ) as HTMLTextAreaElement;
    fireEvent.change(box, { target: { value: USER_BRIEF } });

    fireEvent.click(await screen.findByText("ai.generate"));
    await waitFor(() => expect(mocks.planSelStory).toHaveBeenCalledTimes(1));
    const planInput = mocks.planSelStory.mock.calls[0][0] as Record<string, unknown>;
    expect(planInput.childProfileId).toBe(CHILD_UUID);
    expect(planInput.childName).toBe("Omar");
    expect(planInput.age).toBe(7);
    expect(planInput.customPrompt).toBe(USER_BRIEF);

    // The exact payload the backend receives for /stories/plan.
    const planDto = toCreateStoryRequest(planInput as never);
    expect(planDto.childId).toBe(CHILD_UUID);
    expect(planDto.preferences).toMatchObject({ childName: "Omar", age: 7 });
    expect(planDto.preferences?.customPrompt).toContain(USER_BRIEF);
    expect(planDto.preferences?.customPrompt).toContain("The main character is Omar");

    fireEvent.click(await screen.findByRole("button", { name: /Write the story/i }));
    await waitFor(() => expect(mocks.composeSelStory).toHaveBeenCalledTimes(1));
    const createInput = mocks.composeSelStory.mock.calls[0][0] as Record<string, unknown>;
    expect(createInput.customPrompt).toBe(USER_BRIEF);
    const createDto = toCreateStoryRequest(createInput as never);
    expect(createDto.preferences?.customPrompt).toContain(USER_BRIEF);
  });
});
