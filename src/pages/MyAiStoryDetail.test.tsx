import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import MyAiStoryDetail from "./MyAiStoryDetail";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { useIllustrations } from "@/hooks/useIllustrations";
import { useRetryIllustrations, useRegeneratePageIllustration } from "@/hooks/useGenerateIllustrations";
import { useStoryAudio, useGenerateAudio, useRetryAudio, useDeleteAudio } from "@/hooks/useStoryAudio";
import { illustrateSelStory } from "@/lib/selStoryApi";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: "123",
              title: "Test Story",
              pages: [{ text: "Once upon a time" }],
              language: "en",
              created_at: new Date().toISOString()
            },
            error: null
          })
        }))
      }))
    }))
  }
}));

vi.mock("@/hooks/useIllustrations");
vi.mock("@/hooks/useGenerateIllustrations", () => ({
  useRetryIllustrations: vi.fn(),
  useRegeneratePageIllustration: vi.fn(),
}));
vi.mock("@/lib/selStoryApi", () => ({
  illustrateSelStory: vi.fn(),
  exportStoryPdf: vi.fn(),
}));
vi.mock("@/hooks/useStoryAudio", () => ({
  useStoryAudio: vi.fn(),
  useGenerateAudio: vi.fn(),
  useRetryAudio: vi.fn(),
  useDeleteAudio: vi.fn(),
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({ session: { user: { id: "user-1" } } }))
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const renderComponent = () => {
  return render(
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/story/123"]}>
          <Routes>
            <Route path="/story/:id" element={<MyAiStoryDetail />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </HelmetProvider>
  );
};

describe("MyAiStoryDetail Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();

    // Default mock implementations for illustrations
    vi.mocked(useRetryIllustrations).mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    vi.mocked(useRegeneratePageIllustration).mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    vi.mocked(illustrateSelStory).mockResolvedValue({
      storyId: "123",
      illustrations: [{ index: 1, imageUrl: "http://test.image/img.jpg", status: "ready" }],
    });

    // Default mock implementations for audio narration
    vi.mocked(useStoryAudio).mockReturnValue({ data: null, isLoading: false } as any);
    vi.mocked(useGenerateAudio).mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    vi.mocked(useRetryAudio).mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
    vi.mocked(useDeleteAudio).mockReturnValue({ mutate: vi.fn(), isPending: false } as any);
  });

  it("renders illustrations when API returns data", async () => {
    vi.mocked(useIllustrations).mockReturnValue({
      data: {
        jobStatus: "COMPLETED",
        totalPages: 1,
        completedPages: 1,
        failedPages: 0,
        illustrations: [{ pageNumber: 1, imageUrl: "http://test.image/img.jpg", status: "COMPLETED" }]
      },
      isLoading: false
    } as any);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Once upon a time")).toBeInTheDocument();
    });

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "http://test.image/img.jpg");
  });

  it("automatically recovers missing images on reopen", async () => {
    vi.mocked(useIllustrations).mockReturnValue({
      data: {
        jobStatus: "NONE",
        totalPages: 0,
        completedPages: 0,
        failedPages: 0,
        illustrations: []
      },
      isLoading: false
    } as any);
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Once upon a time")).toBeInTheDocument();
    });

    await waitFor(() => expect(illustrateSelStory).toHaveBeenCalledWith(
      expect.objectContaining({ storyId: "123", pages: [expect.objectContaining({ index: 1, text: "Once upon a time" })] }),
      { trigger: "story_recovery", source: "MyAiStoryDetail.autoRecovery" },
    ));
  });

  it("shows loading state when generating", async () => {
    vi.mocked(useIllustrations).mockReturnValue({
      data: {
        jobStatus: "NONE",
        totalPages: 0,
        completedPages: 0,
        failedPages: 0,
        illustrations: []
      },
      isLoading: false
    } as any);
    vi.mocked(illustrateSelStory).mockImplementation(() => new Promise(() => undefined));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Generating illustration...")).toBeInTheDocument();
    });
  });
});
