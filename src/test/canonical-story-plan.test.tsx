import { describe, it, expect, vi } from "vitest";
import { planSelStory } from "../lib/selStoryApi";
import { axiosInstance } from "../api/client";

vi.mock("../api/client", () => ({
  axiosInstance: {
    post: vi.fn(),
  },
}));

describe("Canonical StoryPlan API & Frontend Preview Compatibility", () => {
  it("processes canonical backend /stories/plan response without error and produces safe preview blueprint", async () => {
    const canonicalBackendResponse = {
      title: "Omar and the Lost Sky Crystal",
      characters: [
        {
          name: "Omar",
          role: "hero",
          description: "A brave child",
        },
        {
          name: "Lumi",
          role: "companion",
          description: "A small friendly blue dragon",
        },
      ],
      conflict: "The magical crystal protecting the Sky Kingdom is missing.",
      resolution: "Omar and Lumi restore the crystal.",
      selGoals: ["Courage", "Friendship"],
      pageCount: 11,
    };

    vi.mocked(axiosInstance.post).mockResolvedValueOnce({
      data: canonicalBackendResponse,
    });

    const canonicalChildId = "00000000-0000-4000-8000-000000000001";
    const result = await planSelStory({
      childProfileId: canonicalChildId,
      childName: "Omar",
      age: 7,
      theme: "Adventure",
      emotionalFocus: ["Courage", "Friendship"],
      language: "en",
    });

    expect(result).toBeDefined();
    expect(result.blueprint).toBeDefined();

    const bp = result.blueprint as any;
    expect(bp.title).toBe("Omar and the Lost Sky Crystal");
    expect(bp.hero).toBeDefined();
    expect(bp.hero.name).toBe("Omar");
    expect(bp.companion).toBeDefined();
    expect(bp.companion.name).toBe("Lumi");
    expect(bp.acts).toBeDefined();
    expect(bp.acts.act2_disturbance).toBe("The magical crystal protecting the Sky Kingdom is missing.");

    // Verify canonical fields are also present on blueprint
    expect(bp.characters).toHaveLength(2);
    expect(bp.characters[0].name).toBe("Omar");
    expect(bp.conflict).toBe("The magical crystal protecting the Sky Kingdom is missing.");
    expect(bp.resolution).toBe("Omar and Lumi restore the crystal.");
    expect(bp.selGoals).toEqual(["Courage", "Friendship"]);
    expect(bp.pageCount).toBe(11);

    // Verify 90s timeout configuration passed to axiosInstance.post
    expect(axiosInstance.post).toHaveBeenCalledWith(
      "/stories/plan",
      {
        childId: canonicalChildId,
        theme: "Adventure",
        selGoal: "Courage, Friendship",
        language: "en",
      },
      {
        timeout: 90000,
      }
    );
  });
});
