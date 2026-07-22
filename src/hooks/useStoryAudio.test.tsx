// src/hooks/useStoryAudio.test.tsx
import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useStoryAudio, useGenerateAudio, useRetryAudio, useDeleteAudio } from "./useStoryAudio";
import { fetchAudio, generateAudio, retryAudio, deleteAudio } from "@/api/audio.api";
import React from "react";

vi.mock("@/api/audio.api", () => ({
  fetchAudio: vi.fn(),
  generateAudio: vi.fn(),
  retryAudio: vi.fn(),
  deleteAudio: vi.fn(),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe("useStoryAudio hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it("should fetch audio status successfully", async () => {
    const mockData = { status: "COMPLETED", audioUrl: "http://test.mp3" };
    vi.mocked(fetchAudio).mockResolvedValueOnce(mockData as any);

    const { result } = renderHook(() => useStoryAudio("123"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockData);
    expect(fetchAudio).toHaveBeenCalledWith("123");
  });

  it("should trigger generateAudio successfully", async () => {
    const mockResult = { mediaId: "media-123", status: "PENDING" };
    vi.mocked(generateAudio).mockResolvedValueOnce(mockResult);

    const { result } = renderHook(() => useGenerateAudio(), { wrapper });

    result.current.mutate("123");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockResult);
    expect(generateAudio).toHaveBeenCalledWith("123");
  });

  it("should trigger retryAudio successfully", async () => {
    const mockResult = { mediaId: "media-123", status: "PENDING" };
    vi.mocked(retryAudio).mockResolvedValueOnce(mockResult);

    const { result } = renderHook(() => useRetryAudio(), { wrapper });

    result.current.mutate("123");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockResult);
    expect(retryAudio).toHaveBeenCalledWith("123");
  });

  it("should trigger deleteAudio successfully", async () => {
    const mockResult = { success: true };
    vi.mocked(deleteAudio).mockResolvedValueOnce(mockResult);

    const { result } = renderHook(() => useDeleteAudio(), { wrapper });

    result.current.mutate("123");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockResult);
    expect(deleteAudio).toHaveBeenCalledWith("123");
  });
});
