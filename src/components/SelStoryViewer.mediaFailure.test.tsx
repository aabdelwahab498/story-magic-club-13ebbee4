/**
 * Regression: a completed story must never be erased or hidden by a downstream
 * media failure (illustrations, PDF export). The reader keeps the full text and
 * a repeated click never queues a duplicate illustration job.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ApiError } from "@/api/errors";

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
  const actual = await vi.importActual<typeof import("@/lib/selStoryApi")>(
    "@/lib/selStoryApi",
  );
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
import type { SelStoryResponse } from "@/lib/selStoryApi";

const story: SelStoryResponse = {
  story_id: "s1",
  title: "Leo's Brave Hello",
  pages: [
    { index: 1, text: "Leo woke up early.", emotionTag: "calm", illustrationPrompt: "p1" },
    { index: 2, text: "Leo said hello.", emotionTag: "joy", illustrationPrompt: "p2" },
  ],
  sel_outcome: { skill: "Courage", emotion: "calm", statement: "x" },
  character_visual_hash: "h",
  age_band: "6-8",
  quality: { total: 22, passed: true, scores: {} },
  safety: { passed: true, violations: [] },
  length: { passed: true, pageCount: 2 },
  passed: true,
  regeneration_count: 0,
};

const renderViewer = () =>
  render(
    <MemoryRouter>
      <SelStoryViewer story={story} onBack={() => {}} />
    </MemoryRouter>,
  );

describe("completed story survives downstream media failures", () => {
  beforeEach(() => {
    illustrateMock.mockReset();
    exportMock.mockReset();
  });

  it("keeps the story readable when illustration generation fails", async () => {
    illustrateMock.mockRejectedValue(
      new ApiError(500, "media failed", { code: "INTERNAL_ERROR" }),
    );
    renderViewer();
    fireEvent.click(screen.getByTestId("illustrate-download-button"));
    await waitFor(() => expect(illustrateMock).toHaveBeenCalledTimes(1));

    expect(screen.getByText("Leo's Brave Hello")).toBeTruthy();
    expect(screen.getByText(/Leo woke up early/)).toBeTruthy();

  });

  it("keeps the story readable when the PDF export fails", async () => {
    illustrateMock.mockResolvedValue({
      storyId: "s1",
      illustrations: [
        { index: 1, imageUrl: "https://img/1.png", status: "ready" },
        { index: 2, imageUrl: "https://img/2.png", status: "ready" },
      ],
    });
    exportMock.mockRejectedValue(new ApiError(503, "busy", { code: "AI_PROVIDER_TEMPORARILY_UNAVAILABLE" }));
    renderViewer();
    fireEvent.click(screen.getByTestId("illustrate-download-button"));
    await waitFor(() => expect(illustrateMock).toHaveBeenCalledTimes(1));

    expect(screen.getByText("Leo's Brave Hello")).toBeTruthy();
    expect(screen.getByText(/Leo woke up early/)).toBeTruthy();
  });

  it("does not queue a duplicate illustration job on repeated clicks", async () => {
    let release: (v: unknown) => void = () => {};
    illustrateMock.mockImplementation(() => new Promise((r) => { release = r; }));
    renderViewer();
    const btn = screen.getByTestId("illustrate-download-button");
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    await waitFor(() => expect(illustrateMock).toHaveBeenCalledTimes(1));
    release({ storyId: "s1", illustrations: [] });
    expect(illustrateMock).toHaveBeenCalledTimes(1);
  });
});
