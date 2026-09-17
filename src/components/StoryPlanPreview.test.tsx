import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ apiClient: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { access_token: "tok" } } })),
      getUser: vi.fn(),
    },
  },
}));

vi.mock("@/api/client", () => ({ apiClient: (...a: unknown[]) => mocks.apiClient(...a) }));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_k: string, d?: string) => d ?? _k }),
}));

import StoryPlanPreview from "@/components/StoryPlanPreview";
import { planSelStory, composeSelStory, type ComposeStoryInput } from "@/lib/selStoryApi";

/** Exact canonical Backend Core V6R3 `POST /api/v2/stories/plan` response. */
const CANONICAL_PLAN = {
  title: "Omar and the Lost Sky Crystal",
  characters: [
    { name: "Omar", role: "hero", description: "A brave child" },
    { name: "Lumi", role: "companion", description: "A small friendly blue dragon" },
  ],
  conflict: "The magical crystal protecting the Sky Kingdom is missing.",
  resolution: "Omar and Lumi restore the crystal.",
  selGoals: ["Courage", "Friendship"],
  pageCount: 11,
};

const CHILD_UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

const input: ComposeStoryInput = {
  childProfileId: CHILD_UUID,
  childName: "Omar",
  age: 8,
  theme: "courage",
  emotionalFocus: ["courage"],
  language: "en",
  customPrompt: "Hero name: Omar.",
};

describe("StoryPlanPreview — canonical StoryPlan regression", () => {
  beforeEach(() => mocks.apiClient.mockReset());

  it("renders the canonical plan without throwing and without undefined.name access", () => {
    expect(() =>
      render(<StoryPlanPreview plan={CANONICAL_PLAN} onEdit={() => {}} onApprove={() => {}} />),
    ).not.toThrow();

    expect(screen.getByText("Omar and the Lost Sky Crystal")).toBeTruthy();
    expect(screen.getByText("Omar")).toBeTruthy();
    expect(screen.getByText("Lumi")).toBeTruthy();
    expect(
      screen.getByText("The magical crystal protecting the Sky Kingdom is missing."),
    ).toBeTruthy();
    expect(screen.getByText("Omar and Lumi restore the crystal.")).toBeTruthy();
    expect(screen.getByText("Courage, Friendship")).toBeTruthy();
    // The user can continue.
    expect(screen.getByRole("button", { name: /Write the story/i })).toBeTruthy();
  });

  it.each([
    ["empty object", {}],
    ["null", null],
    ["characters without hero role", { title: "T", characters: [{ description: "x" }] }],
    ["legacy shape", { title: "T", hero: { name: "Old" }, acts: {}, selOutcome: { statement: "s" } }],
  ])("renders defensively for %s", (_label, plan) => {
    expect(() =>
      render(<StoryPlanPreview plan={plan} onEdit={() => {}} onApprove={() => {}} />),
    ).not.toThrow();
  });

  it("reaches POST /stories with the same canonical child UUID after plan approval", async () => {
    mocks.apiClient.mockResolvedValueOnce(CANONICAL_PLAN);
    const plan = await planSelStory(input);
    expect(plan.blueprint.hero.name).toBe("Omar");

    mocks.apiClient
      .mockResolvedValueOnce({ id: "s1", childId: CHILD_UUID, status: "queued", createdAt: "", updatedAt: "" })
      .mockResolvedValueOnce({
        id: "s1",
        childId: CHILD_UUID,
        status: "completed",
        title: CANONICAL_PLAN.title,
        pages: [{ pageNumber: 1, text: "Once..." }],
        createdAt: "",
        updatedAt: "",
      });

    await composeSelStory({ ...input, presetBlueprint: plan.blueprint });

    const planCall = mocks.apiClient.mock.calls[0];
    const createCall = mocks.apiClient.mock.calls[1];
    expect(planCall[0]).toBe("/stories/plan");
    expect(createCall[0]).toBe("/stories");
    expect(JSON.parse(planCall[1].body).childId).toBe(CHILD_UUID);
    expect(JSON.parse(createCall[1].body).childId).toBe(CHILD_UUID);
  });
});
