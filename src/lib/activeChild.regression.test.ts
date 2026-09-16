/**
 * Regression tests for the FINAL CUSTOMER E2E blocker: the visible active child
 * and the child identity used by the authenticated compose/create path must be
 * the same resolved canonical child_profiles UUID.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { childrenApi } from "@/api/children.api";
import { storiesApi } from "@/api/stories.api";
import {
  resolveActiveChild,
  getActiveChildId,
  setActiveChildId,
} from "@/lib/childProfilesApi";
import {
  toCreateStoryRequest,
  planSelStory,
  normalizePlanBlueprint,
  ComposeStoryError,
} from "@/lib/selStoryApi";

vi.mock("@/api/children.api", () => ({
  childrenApi: { getChildren: vi.fn() },
}));

vi.mock("@/api/stories.api", async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return {
    ...actual,
    storiesApi: { planStory: vi.fn(), createStory: vi.fn(), getStoryById: vi.fn() },
  };
});

const LAYLA = {
  id: "9b4c1c3e-1111-4a7e-9d51-aaaaaaaaaaaa",
  name: "Layla",
  age: 6,
  language: "en",
  emotionalGoals: ["courage"],
  createdAt: "",
  updatedAt: "",
};
const OMAR = { ...LAYLA, id: "56e4ed82-bcd8-4da4-a827-e1213822cab8", name: "Omar" };

/** Mirrors AIStoryteller.buildSelInput: resolve first, then build the payload. */
const buildInput = async () => {
  const child = await resolveActiveChild();
  if (!child?.id) {
    throw new ComposeStoryError("child_required", "Please select a child profile.");
  }
  return {
    childProfileId: child.id,
    childName: child.name,
    age: child.age,
    theme: "Adventure",
    emotionalFocus: child.emotionalGoals,
    language: "en",
    customPrompt: `Hero name: ${child.name}.`,
  };
};

beforeEach(() => {
  localStorage.clear();
  vi.mocked(childrenApi.getChildren).mockReset();
  vi.mocked(storiesApi.planStory).mockReset();
  vi.mocked(storiesApi.createStory).mockReset();
});

describe("active child → plan/create contract", () => {
  it("A) valid stored child ID → the same child reaches plan and create", async () => {
    vi.mocked(childrenApi.getChildren).mockResolvedValue([OMAR, LAYLA]);
    setActiveChildId(LAYLA.id);
    const input = await buildInput();
    expect(input.childProfileId).toBe(LAYLA.id);
    expect(toCreateStoryRequest(input).childId).toBe(LAYLA.id);
  });

  it("B) stale stored child ID → a valid RLS-visible child is resolved", async () => {
    vi.mocked(childrenApi.getChildren).mockResolvedValue([LAYLA]);
    setActiveChildId("deleted-or-foreign-child-id");
    const input = await buildInput();
    expect(input.childProfileId).toBe(LAYLA.id);
    expect(getActiveChildId()).toBe(LAYLA.id);
  });

  it("C) no stored ID + existing child → existing child resolved, none created", async () => {
    vi.mocked(childrenApi.getChildren).mockResolvedValue([LAYLA, OMAR]);
    const input = await buildInput();
    expect(input.childProfileId).toBe(LAYLA.id);
    expect(childrenApi.getChildren).toHaveBeenCalled();
  });

  it("D) resolution still pending → generation cannot start", async () => {
    let release: (v: typeof LAYLA[]) => void = () => undefined;
    vi.mocked(childrenApi.getChildren).mockReturnValue(
      new Promise((res) => {
        release = res as (v: typeof LAYLA[]) => void;
      }) as Promise<typeof LAYLA[]>,
    );
    const pending = buildInput();
    expect(storiesApi.planStory).not.toHaveBeenCalled();
    expect(storiesApi.createStory).not.toHaveBeenCalled();
    release([LAYLA]);
    await expect(pending).resolves.toMatchObject({ childProfileId: LAYLA.id });
  });

  it("E) no child profiles → controlled child_required state, no crash", async () => {
    vi.mocked(childrenApi.getChildren).mockResolvedValue([]);
    await expect(buildInput()).rejects.toBeInstanceOf(ComposeStoryError);
    expect(storiesApi.createStory).not.toHaveBeenCalled();
  });

  it("G) plan and create receive the exact same canonical child UUID", async () => {
    vi.mocked(childrenApi.getChildren).mockResolvedValue([LAYLA]);
    vi.mocked(storiesApi.planStory).mockResolvedValue({
      title: "Layla and the Lost Firefly Gem",
      characters: [{ name: "Layla", role: "hero", description: "brave" }],
      conflict: "the gem is lost",
      resolution: "she finds it",
      selGoals: ["courage"],
      pageCount: 5,
    } as never);
    vi.mocked(storiesApi.createStory).mockResolvedValue({ id: "story-1" } as never);

    const input = await buildInput();
    await planSelStory(input);
    await storiesApi.createStory(toCreateStoryRequest(input));

    const planArg = vi.mocked(storiesApi.planStory).mock.calls[0][0];
    const createArg = vi.mocked(storiesApi.createStory).mock.calls[0][0];
    expect(planArg.childId).toBe(LAYLA.id);
    expect(createArg.childId).toBe(planArg.childId);
  });
});

describe("F) plan preview never dereferences undefined", () => {
  it("normalizes the canonical V6R3 plan shape into a renderable blueprint", () => {
    const bp = normalizePlanBlueprint(
      {
        title: "Layla and the Lost Firefly Gem",
        characters: [{ name: "Layla", role: "hero", description: "brave" }],
        conflict: "the gem is lost",
        resolution: "she finds it",
        selGoals: ["Hero name: Layla."],
        pageCount: 5,
      },
      "Layla",
    );
    expect(bp.hero.name).toBe("Layla");
    expect(bp.acts.act2_disturbance).toBe("the gem is lost");
    expect(bp.acts.act4_resolution).toBe("she finds it");
    expect(Array.isArray(bp.acts.act3_attempts)).toBe(true);
    expect(bp.selOutcome.statement).toContain("Layla");
  });

  it("never throws on an empty or malformed plan payload", () => {
    for (const raw of [undefined, null, {}, { characters: null }]) {
      const bp = normalizePlanBlueprint(raw);
      expect(typeof bp.hero.name).toBe("string");
      expect(typeof bp.acts.act1_normalWorld).toBe("string");
      expect(typeof bp.selOutcome.statement).toBe("string");
    }
  });

  it("still supports the legacy blueprint shape", () => {
    const bp = normalizePlanBlueprint({
      title: "T",
      hero: { name: "Sami", charm: "kind" },
      acts: {
        act1_normalWorld: "a",
        act2_disturbance: "b",
        act3_attempts: ["c"],
        act4_resolution: "d",
      },
      selOutcome: { skill: "s", emotion: "e", statement: "st" },
    });
    expect(bp.hero.name).toBe("Sami");
    expect(bp.selOutcome.statement).toBe("st");
  });
});
