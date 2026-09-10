import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthProvider, useAuth } from "./useAuth";
import { authApi } from "@/api/auth.api";

vi.mock("@/api/auth.api", () => ({
  authApi: { getIdentityContext: vi.fn(), signOut: vi.fn() },
}));

/** In-memory stand-in for the persisted Supabase session. */
let stored: any = null;
let authCallback: ((event: string, session: unknown) => void) | null = null;
const signOutSpy = vi.fn(() => {
  stored = null;
  return Promise.resolve({ error: null });
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: (e: string, s: unknown) => void) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      getSession: () => Promise.resolve({ data: { session: stored } }),
      signOut: (...args: unknown[]) => signOutSpy(...(args as [])),
    },
    from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }),
  },
}));

const session = (id = "u1") => ({
  access_token: `tok-${id}`,
  user: { id, email: `${id}@example.com` },
});

const getIdentityContext = authApi.getIdentityContext as unknown as ReturnType<typeof vi.fn>;

describe("canonical Supabase session lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stored = null;
    authCallback = null;
    getIdentityContext.mockResolvedValue({
      id: "u1",
      email: "u1@example.com",
      role: "user",
      roles: ["user"],
      permissions: [],
    });
  });

  it("persists the session after a successful sign-in", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toBeNull();

    // signInWithPassword -> SIGNED_IN event
    stored = session();
    await act(async () => {
      authCallback?.("SIGNED_IN", stored);
    });

    await waitFor(() => expect(result.current.user?.id).toBe("u1"));
    expect(stored).not.toBeNull();
  });

  it("restores the session on reload", async () => {
    stored = session();
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.user?.id).toBe("u1"));
    expect(result.current.session?.access_token).toBe("tok-u1");
  });

  it("sends the Supabase access token as a Bearer token to /api/v2/me", async () => {
    stored = session();
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.rbacLoaded).toBe(true));
    expect(getIdentityContext).toHaveBeenCalledWith("tok-u1");
  });

  it("makes no authenticated backend call before auth init resolves", async () => {
    stored = null;
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.rbacLoaded).toBe(true));
    expect(getIdentityContext).not.toHaveBeenCalled();
  });

  it("clears session and RBAC state on sign out", async () => {
    stored = session();
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.rbacLoaded).toBe(true));

    await act(async () => {
      await result.current.signOut();
    });

    expect(signOutSpy).toHaveBeenCalled();
    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
    expect(result.current.roles).toEqual([]);
    expect(result.current.permissions).toEqual([]);
    expect(stored).toBeNull();
  });
});
