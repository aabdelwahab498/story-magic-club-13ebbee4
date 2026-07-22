import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useIllustrations } from "./useIllustrations";
import { fetchIllustrations } from "@/api/illustrations.api";
import React from "react";

vi.mock("@/api/illustrations.api", () => ({
  fetchIllustrations: vi.fn(),
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe("useIllustrations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  it("should fetch illustrations successfully", async () => {
    const mockData = [{ pageNumber: 1, imageUrl: "test.jpg", status: "COMPLETED" }];
    vi.mocked(fetchIllustrations).mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useIllustrations("123"), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockData);
    expect(fetchIllustrations).toHaveBeenCalledWith("123");
  });
});
