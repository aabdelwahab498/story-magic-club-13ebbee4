import { describe, it, expect, vi, beforeEach } from "vitest";

const invoke = vi.fn();
const getSession = vi.fn(async () => ({
  data: { session: { access_token: "test-access-token" } },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke },
    auth: { getSession, getUser: vi.fn() },
  },
}));

const apiClient = vi.fn();
vi.mock("@/api/client", () => ({ apiClient: (...a: unknown[]) => apiClient(...a) }));

import { planSelStory, composeSelStory, type ComposeStoryInput } from "@/lib/selStoryApi";

const input: ComposeStoryInput = {
  childProfileId: "11111111-2222-3333-4444-555555555555",
  childName: "Layla",
  age: 7,
  theme: "courage",
  emotionalFocus: ["courage"],
  language: "en",
};

describe("authenticated canonical story creation", () => {
  beforeEach(() => {
    invoke.mockReset();
    apiClient.mockReset();
  });

  it("calls POST /stories/plan with the Supabase bearer token", async () => {
    apiClient.mockResolvedValue({ title: "T" });
    await planSelStory(input);
    const [endpoint, options] = apiClient.mock.calls[0];
    expect(endpoint).toBe("/stories/plan");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer test-access-token");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("calls POST /stories and polls until terminal, without any edge function", async () => {
    apiClient
      .mockResolvedValueOnce({ id: "story-1", childId: input.childProfileId, status: "queued", createdAt: "", updatedAt: "" })
      .mockResolvedValueOnce({ id: "story-1", childId: input.childProfileId, status: "completed", title: "Brave Layla", pages: [{ pageNumber: 1, text: "Once..." }], createdAt: "", updatedAt: "" });

    const res = await composeSelStory(input);

    expect(apiClient.mock.calls[0][0]).toBe("/stories");
    expect(apiClient.mock.calls[0][1].method).toBe("POST");
    expect(apiClient.mock.calls[0][1].headers.Authorization).toBe("Bearer test-access-token");
    expect(JSON.parse(apiClient.mock.calls[0][1].body)).toMatchObject({
      childId: input.childProfileId,
      theme: "courage",
      selGoal: "courage",
      language: "en",
      preferences: { childName: "Layla", age: 7, emotionalFocus: ["courage"] },
    });
    expect(apiClient.mock.calls[1][0]).toBe("/stories/story-1");
    expect(res.title).toBe("Brave Layla");
    expect(res.pages).toHaveLength(1);

    // Legacy edge functions must never be used for authenticated generation.
    expect(invoke).not.toHaveBeenCalled();
  });
});
