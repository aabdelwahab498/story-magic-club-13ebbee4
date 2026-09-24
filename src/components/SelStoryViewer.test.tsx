// Integration tests: Illustrate button state + per-page readiness badge.
// Asserts Function B (illustration) UI reacts to image-availability updates.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// --- Mocks (must come before importing the component) ---
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
    functions: { invoke: vi.fn() },
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "u1" } }),
}));

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
vi.mock("@/lib/selStoryApi", async () => {
  const actual = await vi.importActual<typeof import("@/lib/selStoryApi")>(
    "@/lib/selStoryApi",
  );
  return {
    ...actual,
    illustrateSelStory: (...args: unknown[]) => illustrateMock(...args),
    exportStoryPdf: vi.fn().mockResolvedValue("https://example.com/x.pdf"),
  };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_k: string, d?: string) => d ?? _k, i18n: { language: "en" } }),
}));

import { SelStoryViewer } from "./SelStoryViewer";
import type { SelStoryResponse } from "@/lib/selStoryApi";

const storyFixture = (withImages = false): SelStoryResponse => ({
  story_id: "s1",
  title: "Test Story",
  pages: [
    { index: 1, text: "p1", emotionTag: "calm", illustrationPrompt: "p1", imageUrl: withImages ? "u1" : undefined },
    { index: 2, text: "p2", emotionTag: "joy",  illustrationPrompt: "p2", imageUrl: withImages ? "u2" : undefined },
  ],
  sel_outcome: { skill: "Empathy", emotion: "calm", statement: "x" },
  character_visual_hash: "h",
  age_band: "6-8",
  quality: { total: 22, passed: true, scores: {} },
  safety: { passed: true, violations: [] },
  length: { passed: true, pageCount: 2 },
  passed: true,
  regeneration_count: 0,
});

const renderViewer = (story: SelStoryResponse) =>
  render(
    <MemoryRouter>
      <SelStoryViewer story={story} onBack={() => {}} />
    </MemoryRouter>,
  );

beforeEach(() => {
  illustrateMock.mockReset();
});

describe("SelStoryViewer — Illustrate button + readiness badge", () => {
  it("shows 0/N badge and a preparing PDF label when no images are ready", () => {
    renderViewer(storyFixture(false));
    const badge = screen.getByTestId("illustration-readiness-badge");
    expect(badge.textContent).toMatch(/0\/2/);
    const btn = screen.getByText("Illustrate");
    expect(btn).toHaveAttribute("data-all-ready", "false");
    expect(btn.textContent).toMatch(/PDF preparing/);
    expect(btn).not.toBeDisabled();
  });

  it("renders 'Download PDF' and emerald 'all ready' badge when every page has imageUrl", () => {
    renderViewer(storyFixture(true));
    const btn = screen.getByText("Illustrate");
    expect(btn).toHaveAttribute("data-all-ready", "true");
    expect(btn.textContent).toMatch(/Download PDF/);
    const badge = screen.getByTestId("illustration-readiness-badge");
    expect(badge.textContent).toMatch(/All illustrations ready/);
  });

  it("renders one progress dot per page with status=queued when no images present", () => {
    renderViewer(storyFixture(false));
    const dot1 = screen.getByTestId("illustration-page-1");
    const dot2 = screen.getByTestId("illustration-page-2");
    expect(dot1).toHaveAttribute("data-status", "queued");
    expect(dot2).toHaveAttribute("data-status", "queued");
  });

  it("updates badge + per-page status to 'complete' after illustrate resolves", async () => {
    illustrateMock.mockResolvedValueOnce({
      storyId: "s1",
      illustrations: [
        { index: 1, imageUrl: "https://img/1.png", status: "ready" },
        { index: 2, imageUrl: "https://img/2.png", status: "ready" },
      ],
    });
    renderViewer(storyFixture(false));
    fireEvent.click(screen.getByText("Illustrate"));

    await waitFor(() => {
      expect(screen.getByTestId("illustration-page-1")).toHaveAttribute("data-status", "complete");
      expect(screen.getByTestId("illustration-page-2")).toHaveAttribute("data-status", "complete");
    });
    expect(screen.getByTestId("illustration-readiness-badge").textContent).toMatch(/All illustrations ready/);

    // illustrateSelStory was called with trigger:"user"
    expect(illustrateMock).toHaveBeenCalledTimes(1);
    expect(illustrateMock.mock.calls[0][1]).toMatchObject({ trigger: "user" });
  });

  it("marks failed pages with status=error and shows a 'Retry failed' button", async () => {
    illustrateMock.mockResolvedValueOnce({
      storyId: "s1",
      illustrations: [
        { index: 1, imageUrl: "https://img/1.png", status: "ready" },
        { index: 2, imageUrl: null, status: "failed", error: "boom" },
      ],
    });
    renderViewer(storyFixture(false));
    fireEvent.click(screen.getByText("Illustrate"));

    await waitFor(() => {
      expect(screen.getByTestId("illustration-page-2")).toHaveAttribute("data-status", "error");
    });
    expect(screen.getByTestId("illustration-page-1")).toHaveAttribute("data-status", "complete");
    expect(screen.getByTestId("illustration-readiness-badge").textContent).toMatch(/1\/2/);
  });
});
