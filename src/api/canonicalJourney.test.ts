/**
 * Runtime convergence guards for the authenticated customer journey.
 * Proves illustration state, narration and illustrated PDF export all go to the
 * canonical Backend Core API with a Supabase bearer token, and that pending or
 * missing media never throws.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  del: vi.fn(),
  invoke: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  axiosInstance: {
    get: (...a: unknown[]) => mocks.get(...a),
    post: (...a: unknown[]) => mocks.post(...a),
    delete: (...a: unknown[]) => mocks.del(...a),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: mocks.invoke },
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { access_token: "tok" } } })),
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}));

import { fetchIllustrations } from "@/api/illustrations.api";
import { fetchAudio, generateAudio } from "@/api/audio.api";
import { waitForCanonicalStoryPdf } from "@/api/storyExports.api";
import { exportStoryAsPdf } from "@/lib/storyExportApi";

beforeEach(() => {
  mocks.get.mockReset();
  mocks.post.mockReset();
  mocks.del.mockReset();
  mocks.invoke.mockReset();
});

describe("illustration state (read-only, canonical)", () => {
  it("reads canonical media state and never auto-generates", async () => {
    mocks.get.mockResolvedValue({
      data: {
        jobStatus: "COMPLETED",
        totalPages: 2,
        illustrations: [
          { pageNumber: 1, imageUrl: "https://x/1.png", status: "COMPLETED" },
          { pageNumber: 2, imageUrl: "https://x/2.png", status: "ready" },
        ],
      },
    });
    const res = await fetchIllustrations("story-1");
    expect(mocks.get).toHaveBeenCalledWith("/media/stories/story-1/illustrations");
    expect(res.completedPages).toBe(2);
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("does not crash when media is missing or pending", async () => {
    mocks.get.mockResolvedValue({ data: undefined });
    const res = await fetchIllustrations("story-1");
    expect(res).toEqual({
      jobStatus: "NONE",
      totalPages: 0,
      completedPages: 0,
      failedPages: 0,
      illustrations: [],
    });
  });
});

describe("narration (canonical media pipeline)", () => {
  it("reads narration state from the canonical API", async () => {
    mocks.get.mockResolvedValue({ data: { status: "PENDING", audioUrl: null } });
    const res = await fetchAudio("story-1");
    expect(mocks.get).toHaveBeenCalledWith("/media/stories/story-1/audio");
    expect(res.status).toBe("PENDING");
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("requests narration from the canonical API", async () => {
    mocks.post.mockResolvedValue({ data: { mediaId: "m1", status: "PENDING" } });
    await generateAudio("story-1");
    expect(mocks.post).toHaveBeenCalledWith("/media/stories/story-1/audio");
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("tolerates an empty narration response", async () => {
    mocks.get.mockResolvedValue({ data: null });
    await expect(fetchAudio("story-1")).resolves.toEqual({
      status: "NONE",
      audioUrl: null,
      error: null,
    });
  });
});

describe("illustrated PDF export (canonical)", () => {
  it("waits for illustrations, then returns the canonical download url", async () => {
    mocks.post
      .mockResolvedValueOnce({ data: { status: "WAITING_FOR_ILLUSTRATIONS", progress: { completed: 1, total: 3 } } })
      .mockResolvedValueOnce({ data: { status: "COMPLETED", download_url: "https://x/story.pdf" } });
    const res = await waitForCanonicalStoryPdf("story-1", { intervalMs: 1 });
    expect(mocks.post).toHaveBeenCalledWith("/stories/story-1/export/pdf");
    expect(res.download_url).toBe("https://x/story.pdf");
  });

  it("routes a saved story's PDF through Backend Core, not a browser PDF", async () => {
    mocks.post.mockResolvedValue({ data: { status: "COMPLETED", download_url: "https://x/story.pdf" } });
    const res = await exportStoryAsPdf({
      storyId: "story-1",
      title: "Brave Layla",
      pages: [{ pageNumber: 1, text: "Once..." }],
      language: "en",
    });
    expect(mocks.post).toHaveBeenCalledWith("/stories/story-1/export/pdf");
    expect(res.provider).toBe("backend-core");
    expect(res.downloadUrl).toBe("https://x/story.pdf");
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("keeps the guest/unsaved path on the standalone exporter", async () => {
    mocks.invoke.mockResolvedValue({
      data: {
        success: true,
        export_id: "e1",
        download_url: "https://x/guest.pdf",
        file_name: "guest.pdf",
      },
      error: null,
    });
    const res = await exportStoryAsPdf({
      storyId: null,
      title: "Guest",
      pages: [{ pageNumber: 1, text: "Once..." }],
      language: "en",
    });
    expect(mocks.post).not.toHaveBeenCalled();
    expect(mocks.invoke).toHaveBeenCalled();
    expect(res.downloadUrl).toBe("https://x/guest.pdf");
  });
});
