/**
 * Regression: clicking "Illustrate & Download" on a generated 5-page story must
 * produce a request the illustrate-story function accepts (no
 * missing_or_invalid_fields), with prompts derived from the ACTUAL page
 * content, and the loading state must terminate on an HTTP error while the
 * story text stays intact.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
    functions: { invoke: vi.fn() },
  },
}));

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
vi.mock("@/hooks/useSubscription", () => ({
  useSubscription: () => ({
    canIllustrate: true,
    canExportPdf: true,
    canAudio: true,
    tier: "family",
    loading: false,
  }),
}));

const illustrateMock = vi.fn();
const exportMock = vi.fn();
vi.mock("@/lib/selStoryApi", async () => {
  const actual = await vi.importActual<typeof import("@/lib/selStoryApi")>("@/lib/selStoryApi");
  return {
    ...actual,
    illustrateSelStory: (...args: unknown[]) => illustrateMock(...args),
    exportStoryPdf: (...args: unknown[]) => exportMock(...args),
  };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_k: string, d?: string) => d ?? _k, i18n: { language: "en" } }),
}));

import { SelStoryViewer } from "./SelStoryViewer";
import { fromBackendStory } from "@/lib/selStoryApi";
import type { SelStoryResponse } from "@/lib/selStoryApi";

const PAGE_TEXTS = [
  "Nour packed her bag for the first day of school.",
  "The hallway felt loud and very new.",
  "She took one slow breath and said hello.",
  "A classmate smiled and shared her crayons.",
  "Nour walked home proud of her brave hello.",
];

// Canonical backend story WITHOUT planner illustrationPrompts and WITHOUT a
// characterVisualHash — exactly the payload shape that produced the 400.
const backendStory = {
  id: "19c8983d-e41c-4af7-aef5-e3ba28b62468",
  title: "Nour's Brave Hello",
  status: "completed",
  pages: PAGE_TEXTS.map((text, i) => ({ pageNumber: i + 1, text })),
  metadata: { theme: "school", selGoal: "courage" },
} as unknown as Parameters<typeof fromBackendStory>[0];

const story: SelStoryResponse = fromBackendStory(backendStory, {
  childId: "c1",
  childName: "Nour",
  age: 7,
  theme: "school",
  selGoal: "courage",
  language: "en",
} as unknown as Parameters<typeof fromBackendStory>[1]);

const renderViewer = () =>
  render(
    <MemoryRouter>
      <SelStoryViewer story={story} onBack={() => {}} />
    </MemoryRouter>,
  );

// Mirrors the edge function's validation contract.
function validateAgainstEdgeContract(payload: {
  storyId?: string;
  pages?: { index: number; illustrationPrompt?: string; text?: string }[];
}): { ok: boolean; error?: string } {
  const storyIdOk =
    typeof payload.storyId === "string" && payload.storyId.length > 0 && payload.storyId.length <= 64;
  const pagesOk =
    Array.isArray(payload.pages) &&
    payload.pages.length > 0 &&
    payload.pages.every(
      (p) =>
        p &&
        typeof p.index === "number" &&
        ((typeof p.illustrationPrompt === "string" && p.illustrationPrompt.trim().length > 0) ||
          (typeof p.text === "string" && p.text.trim().length > 0)),
    );
  return storyIdOk && pagesOk ? { ok: true } : { ok: false, error: "missing_or_invalid_fields" };
}

describe("Illustrate & Download request contract (5-page story)", () => {
  beforeEach(() => {
    illustrateMock.mockReset();
    exportMock.mockReset();
  });

  it("sends a valid request whose prompts derive from the real page text", async () => {
    illustrateMock.mockResolvedValue({
      storyId: story.story_id,
      illustrations: PAGE_TEXTS.map((_, i) => ({
        index: i + 1,
        imageUrl: `https://img/${i + 1}.png`,
        status: "ready",
      })),
    });
    exportMock.mockResolvedValue("https://example.com/story.pdf");

    renderViewer();
    await waitFor(() => expect(illustrateMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId("illustrate-download-button")).toHaveAttribute("data-all-ready", "true"));
    fireEvent.click(screen.getByTestId("illustrate-download-button"));
    await waitFor(() => expect(exportMock).toHaveBeenCalledWith(story.story_id, { force: true }));

    const payload = illustrateMock.mock.calls[0][0] as {
      storyId: string;
      pages: { index: number; illustrationPrompt: string; text?: string }[];
      characterVisualHash?: string;
    };

    expect(validateAgainstEdgeContract(payload)).toEqual({ ok: true });
    expect(payload.storyId).toBe("19c8983d-e41c-4af7-aef5-e3ba28b62468");
    expect(payload.pages).toHaveLength(5);
    payload.pages.forEach((p, i) => {
      expect(p.illustrationPrompt.trim().length).toBeGreaterThan(0);
      // Derived from THIS story's canonical page content — not invented.
      expect(p.illustrationPrompt).toContain(PAGE_TEXTS[i].slice(0, 20));
      expect(p.text).toBe(PAGE_TEXTS[i]);
    });
    // Character context is derived (deterministic), never blank-rejected.
    expect(payload.characterVisualHash).toContain(story.story_id!);
  });

  it("exits the loading state and keeps the story after a 400 response", async () => {
    const err = new Error("missing_or_invalid_fields") as Error & { status?: number };
    err.status = 400;
    illustrateMock.mockRejectedValue(err);

    renderViewer();
    await waitFor(() => expect(illustrateMock).toHaveBeenCalledTimes(1));

    await screen.findByTestId("illustration-retry-notice");
    await waitFor(() => expect(screen.getAllByText("Illustrate")[0]).not.toBeDisabled());
    expect(screen.getByText("Nour's Brave Hello")).toBeTruthy();
    PAGE_TEXTS.slice(0, 1).forEach((txt) => {
      expect(screen.getByText(new RegExp(txt.slice(0, 15)))).toBeTruthy();
    });
  });

  it("re-arms automatic illustration after a transient first failure", async () => {
    illustrateMock
      .mockRejectedValueOnce(new Error("temporary_provider_error"))
      .mockResolvedValueOnce({
        storyId: story.story_id,
        illustrations: PAGE_TEXTS.map((_, i) => ({
          index: i + 1,
          imageUrl: `https://img/${i + 1}.png`,
          status: "ready",
        })),
      });

    const view = renderViewer();
    await waitFor(() => expect(illustrateMock).toHaveBeenCalledTimes(1));
    await screen.findByTestId("illustration-retry-notice");

    view.rerender(
      <MemoryRouter>
        <SelStoryViewer story={{ ...story }} onBack={() => {}} />
      </MemoryRouter>,
    );

    await waitFor(() => expect(illustrateMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId("illustrate-download-button")).toHaveAttribute("data-all-ready", "true"));
  });
});
