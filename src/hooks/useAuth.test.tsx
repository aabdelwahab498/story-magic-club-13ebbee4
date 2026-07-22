import { renderHook, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./useAuth";
import { authApi } from "@/api/auth.api";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/api/auth.api", () => ({
  authApi: {
    getMe: vi.fn(),
    signOut: vi.fn(),
  },
}));

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch user from API on mount and set session correctly", async () => {
    const mockMeResponse = {
      id: "user-123",
      email: "test@example.com",
      role: "user",
      roles: ["user"],
      permissions: [],
    };
    
    (authApi.getMe as any).mockResolvedValueOnce(mockMeResponse);

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    // Wait for the async effect to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(authApi.getMe).toHaveBeenCalledTimes(1);
    expect(result.current.user).toBeDefined();
    expect(result.current.user?.email).toBe("test@example.com");
    expect(result.current.roles).toEqual(["user"]);
    expect(result.current.isAdmin).toBe(false);
  });

  it("should handle error gracefully and set session to null", async () => {
    (authApi.getMe as any).mockRejectedValueOnce(new Error("Unauthorized"));

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(authApi.getMe).toHaveBeenCalledTimes(1);
    expect(result.current.user).toBeNull();
    expect(result.current.roles).toEqual([]);
  });

  it("should correctly identify admins", async () => {
    const mockMeResponse = {
      id: "user-123",
      email: "admin@example.com",
      role: "admin",
      roles: ["admin"],
      permissions: [],
    };
    
    (authApi.getMe as any).mockResolvedValueOnce(mockMeResponse);

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isStaff).toBe(true);
  });
});
