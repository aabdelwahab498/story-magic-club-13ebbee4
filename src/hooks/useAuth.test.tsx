import { renderHook, waitFor, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "./useAuth";
import { authApi } from "@/api/auth.api";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/api/auth.api", () => ({
  authApi: { getIdentityContext: vi.fn(), getMe: vi.fn(), signOut: vi.fn() },
}));

let authCallback: ((event: string, session: unknown) => void) | null = null;
let currentSession: any = null;
const rolesRows = { data: [] as { role: string }[], error: null as unknown };

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: (e: string, s: unknown) => void) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      getSession: () => Promise.resolve({ data: { session: currentSession } }),
      signOut: () => Promise.resolve({ error: null }),
    },
    from: () => ({
      select: () => ({ eq: () => Promise.resolve(rolesRows) }),
    }),
  },
}));

const makeSession = (id: string, token = "tok-" + id) => ({
  access_token: token,
  user: { id, email: `${id}@example.com` },
});

const getIdentityContext = authApi.getIdentityContext as unknown as ReturnType<typeof vi.fn>;

describe("useAuth RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authCallback = null;
    currentSession = null;
    rolesRows.data = [];
  });

  it("hydrates roles and permissions from /api/v2/me", async () => {
    currentSession = makeSession("u1");
    getIdentityContext.mockResolvedValue({
      id: "u1",
      email: "u1@example.com",
      role: "editor",
      roles: ["editor", "editor"],
      permissions: ["story.update", "story.update", "story.read"],
    });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => expect(result.current.rbacLoaded).toBe(true));
    expect(getIdentityContext).toHaveBeenCalledWith("tok-u1");
    expect(result.current.roles).toEqual(["editor"]);
    expect(result.current.permissions).toEqual(["story.update", "story.read"]);
    expect(result.current.hasPermission("story.update")).toBe(true);
    expect(result.current.hasPermission("user.manage")).toBe(false);
    expect(result.current.isStaff).toBe(true);
    expect(result.current.isAdmin).toBe(false);
  });

  it("supports multi-role responses and admin bypass", async () => {
    currentSession = makeSession("u2");
    rolesRows.data = [{ role: "admin" }, { role: "user" }];
    getIdentityContext.mockResolvedValue({
      id: "u2",
      email: "a@example.com",
      role: "admin",
      roles: ["admin", "user"],
      permissions: [],
    });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.rbacLoaded).toBe(true));

    expect(result.current.isAdmin).toBe(true);
    expect(result.current.hasPermission("anything")).toBe(true);
  });

  it("treats super_admin as admin", async () => {
    currentSession = makeSession("u3");
    rolesRows.data = [{ role: "super_admin" }];
    getIdentityContext.mockResolvedValue({
      id: "u3",
      email: "s@example.com",
      role: "super_admin",
      roles: ["super_admin"],
      permissions: [],
    });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.rbacLoaded).toBe(true));
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.isStaff).toBe(true);
  });

  it("keeps canonical Cloud admin access when Backend Core returns user", async () => {
    currentSession = makeSession("cloud-admin");
    rolesRows.data = [{ role: "user" }, { role: "admin" }];
    getIdentityContext.mockResolvedValue({
      id: "cloud-admin",
      email: "admin@example.com",
      role: "user",
      roles: ["user"],
      permissions: [],
    });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.rbacLoaded).toBe(true));

    expect(result.current.roles).toEqual(["user", "admin"]);
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.hasPermission("manage_rbac")).toBe(true);
  });

  it("does not accept an admin role that exists only in Backend Core", async () => {
    currentSession = makeSession("backend-only-admin");
    rolesRows.data = [{ role: "user" }];
    getIdentityContext.mockResolvedValue({
      id: "backend-only-admin",
      email: "user@example.com",
      role: "admin",
      roles: ["admin", "user"],
      permissions: ["manage_rbac"],
    });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.rbacLoaded).toBe(true));

    expect(result.current.roles).toEqual(["user"]);
    expect(result.current.isAdmin).toBe(false);
  });

  it("fails closed on /me failure: no permissions granted", async () => {
    currentSession = makeSession("u4");
    getIdentityContext.mockRejectedValue(new Error("network"));
    rolesRows.data = [{ role: "user" }];

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.rbacLoaded).toBe(true));

    expect(result.current.permissions).toEqual([]);
    expect(result.current.hasPermission("story.update")).toBe(false);
  });

  it("resolves immediately with no roles when signed out", async () => {
    currentSession = null;
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.rbacLoaded).toBe(true));
    expect(result.current.roles).toEqual([]);
    expect(result.current.permissions).toEqual([]);
    expect(getIdentityContext).not.toHaveBeenCalled();
  });

  it("clears RBAC on sign out", async () => {
    currentSession = makeSession("u5");
    rolesRows.data = [{ role: "admin" }];
    getIdentityContext.mockResolvedValue({
      id: "u5",
      email: "e@example.com",
      role: "admin",
      roles: ["admin"],
      permissions: ["user.manage"],
    });
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.isAdmin).toBe(true));

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.roles).toEqual([]);
    expect(result.current.permissions).toEqual([]);
    expect(result.current.isAdmin).toBe(false);
  });

  it("never leaks the previous user's RBAC when the identity changes", async () => {
    currentSession = makeSession("admin1");
    rolesRows.data = [{ role: "admin" }];
    getIdentityContext.mockResolvedValue({
      id: "admin1",
      email: "a@example.com",
      role: "admin",
      roles: ["admin"],
      permissions: ["user.manage"],
    });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.isAdmin).toBe(true));

    // Second user's /me resolves after we switch identity.
    getIdentityContext.mockResolvedValue({
      id: "user2",
      email: "u@example.com",
      role: "user",
      roles: ["user"],
      permissions: [],
    });
    rolesRows.data = [{ role: "user" }];

    await act(async () => {
      authCallback?.("SIGNED_IN", makeSession("user2"));
      await new Promise((r) => setTimeout(r, 10));
    });

    await waitFor(() => expect(result.current.roles).toEqual(["user"]));
    expect(result.current.isAdmin).toBe(false);
    expect(result.current.permissions).toEqual([]);
  });

  it("does not re-fetch RBAC on a pure token refresh", async () => {
    currentSession = makeSession("u6");
    getIdentityContext.mockResolvedValue({
      id: "u6",
      email: "u6@example.com",
      role: "user",
      roles: ["user"],
      permissions: ["story.read"],
    });

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });
    await waitFor(() => expect(result.current.rbacLoaded).toBe(true));
    const calls = getIdentityContext.mock.calls.length;

    await act(async () => {
      authCallback?.("TOKEN_REFRESHED", makeSession("u6", "tok-new"));
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(getIdentityContext.mock.calls.length).toBe(calls);
    expect(result.current.permissions).toEqual(["story.read"]);
  });
});
