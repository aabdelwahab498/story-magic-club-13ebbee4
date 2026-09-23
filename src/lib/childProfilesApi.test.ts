import { describe, it, expect, vi, beforeEach } from "vitest";
import { childrenApi } from "@/api/children.api";
import {
  resolveActiveChild,
  getActiveChildId,
  setActiveChildId,
} from "@/lib/childProfilesApi";
import { toCreateStoryRequest, ComposeStoryError } from "@/lib/selStoryApi";

vi.mock("@/api/children.api", () => ({
  childrenApi: { getChildren: vi.fn() },
}));

const OMAR = {
  id: "56e4ed82-bcd8-4da4-a827-e1213822cab8",
  name: "Omar",
  age: 7,
  language: "en",
  emotionalGoals: ["courage"],
  createdAt: "",
  updatedAt: "",
};
const LINA = { ...OMAR, id: "11111111-1111-1111-1111-111111111111", name: "Lina" };

describe("active child resolution", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(childrenApi.getChildren).mockReset();
  });

  it("returns the stored selection by UUID", async () => {
    vi.mocked(childrenApi.getChildren).mockResolvedValue([OMAR, LINA]);
    setActiveChildId(LINA.id);
    const child = await resolveActiveChild();
    expect(child?.id).toBe(LINA.id);
  });

  it("requires an explicit choice when several children exist", async () => {
    vi.mocked(childrenApi.getChildren).mockResolvedValue([OMAR, LINA]);
    expect(await resolveActiveChild()).toBeNull();
    expect(getActiveChildId()).toBeNull();
  });

  it("uses the only child a parent owns and persists it", async () => {
    vi.mocked(childrenApi.getChildren).mockResolvedValue([OMAR]);
    const child = await resolveActiveChild();
    expect(child?.id).toBe(OMAR.id);
    expect(getActiveChildId()).toBe(OMAR.id);
  });

  it("ignores a stale selection that no longer belongs to the user", async () => {
    vi.mocked(childrenApi.getChildren).mockResolvedValue([OMAR]);
    setActiveChildId("deleted-child-id");
    const child = await resolveActiveChild();
    expect(child?.id).toBe(OMAR.id);
  });

  it("returns null only when the user genuinely has no children", async () => {
    vi.mocked(childrenApi.getChildren).mockResolvedValue([]);
    expect(await resolveActiveChild()).toBeNull();
  });

  it("keeps the selection across repeated reads", async () => {
    vi.mocked(childrenApi.getChildren).mockResolvedValue([OMAR, LINA]);
    setActiveChildId(LINA.id);
    await resolveActiveChild();
    await resolveActiveChild();
    expect(getActiveChildId()).toBe(LINA.id);
  });
});

describe("story request contract", () => {
  it("sends the canonical child UUID as childId", () => {
    const dto = toCreateStoryRequest({
      childProfileId: OMAR.id,
      childName: OMAR.name,
      age: OMAR.age,
      theme: "Adventure",
      emotionalFocus: ["courage"],
      language: "en",
      customPrompt: "Hero name: Omar.",
    });
    expect(dto.childId).toBe(OMAR.id);
    expect(dto.theme).toBe("Adventure");
    expect(dto.selGoal).toBe("courage");
    expect(dto.language).toBe("en");
    expect(dto.preferences).toMatchObject({ childName: "Omar", age: 7 });
    // The app injects the protagonist directive; the user's brief is preserved.
    const brief = String((dto.preferences as { customPrompt?: string }).customPrompt);
    expect(brief).toContain("The main character is Omar");
    expect(brief).toContain("Hero name: Omar.");
  });

  it("blocks generation when no child is selected", () => {
    expect(() =>
      toCreateStoryRequest({
        childProfileId: null,
        childName: "the child",
        age: 7,
        theme: "Adventure",
      }),
    ).toThrow(ComposeStoryError);
  });
});
