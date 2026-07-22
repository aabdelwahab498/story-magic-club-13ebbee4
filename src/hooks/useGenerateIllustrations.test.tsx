import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useGenerateIllustrations } from "./useGenerateIllustrations";
import { generateIllustrations } from "@/api/illustrations.api";
import React from "react";

vi.mock("@/api/illustrations.api", () => ({
  generateIllustrations: vi.fn(),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe("useGenerateIllustrations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it("should mutate and call API", async () => {
    const mockData = { storyId: "123", status: "GENERATING" };
    vi.mocked(generateIllustrations).mockResolvedValueOnce(mockData);
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useGenerateIllustrations(), { wrapper });

    result.current.mutate("123");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(generateIllustrations).toHaveBeenCalledWith("123");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['illustrations', '123'] });
  });
});
