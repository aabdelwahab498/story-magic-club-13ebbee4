import { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { AppRole, PermissionKey, ADMIN_ROLES, dedupe } from "@/lib/rbac";
import { authApi } from "@/api/auth.api";

/**
 * Authentication context.
 *
 * - Supabase remains the session authority (login/signup/refresh/logout).
 * - `GET /api/v2/me` is the canonical RBAC authority: roles[] and permissions[]
 *   come from the backend, never from a hardcoded frontend matrix.
 * - If the RBAC endpoint is unreachable, roles fall back to the `user_roles`
 *   table (read under RLS) and permissions resolve to an empty list, so no
 *   privileged permission-gated UI is ever granted on failure.
 */
interface AuthCtx {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  /** True once role resolution has completed (or no user is signed in). */
  rolesLoaded: boolean;
  permissions: PermissionKey[];
  /** True once permission resolution has completed (or no user is signed in). */
  permissionsLoaded: boolean;
  /** True once the whole RBAC resolution cycle has completed. */
  rbacLoaded: boolean;
  hasPermission: (key: PermissionKey) => boolean;
  hasRole: (role: AppRole) => boolean;
  isAdmin: boolean;
  isEditor: boolean;
  isStaff: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshAdmin: () => Promise<void>;
}

const Ctx = createContext<AuthCtx | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [permissions, setPermissions] = useState<PermissionKey[]>([]);
  const [rbacLoaded, setRbacLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  /** Monotonic token: results from stale identities are discarded. */
  const rbacSeq = useRef(0);

  const loadRbac = useCallback(async (nextSession: Session | null) => {
    const seq = ++rbacSeq.current;
    const userId = nextSession?.user?.id;
    const accessToken = nextSession?.access_token;

    // Always clear previous identity's RBAC state before resolving a new one.
    setRoles([]);
    setPermissions([]);

    if (!userId) {
      setRbacLoaded(true);
      return;
    }

    setRbacLoaded(false);

    // Lovable Cloud owns the authenticated identity and its privileged roles.
    // Backend Core may use a different database, so it must never grant or
    // remove admin access for a user authenticated by this project.
    let cloudRoles: AppRole[] = [];
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (error) throw error;
      if (seq !== rbacSeq.current) return;
      cloudRoles = dedupe(((data ?? []) as { role: AppRole }[]).map((r) => r.role));
    } catch {
      if (seq !== rbacSeq.current) return;
    }

    // Backend Core remains the source of fine-grained permissions and
    // non-privileged roles. Privileged roles are accepted only from Cloud.
    if (accessToken) {
      try {
        const me = await authApi.getIdentityContext(accessToken);
        if (seq !== rbacSeq.current) return; // stale identity — discard
        const backendRoles = ((me?.roles ?? []) as AppRole[]).filter(
          (role) => !ADMIN_ROLES.includes(role),
        );
        setRoles(dedupe([...backendRoles, ...cloudRoles]));
        setPermissions(dedupe(me?.permissions ?? []));
        setRbacLoaded(true);
        return;
      } catch {
        if (seq !== rbacSeq.current) return;
        // fall through to role-only resolution below
      }
    }

    // Backend unavailable: retain Cloud roles but fail closed on permissions.
    if (seq === rbacSeq.current) {
      setRoles(cloudRoles);
      setPermissions([]);
      setRbacLoaded(true);
    }
  }, []);

  useEffect(() => {
    // Register the listener first, then read the existing session.
    const { data: sub } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
      // A pure token refresh keeps the same identity: no need to re-resolve RBAC.
      if (event === "TOKEN_REFRESHED") return;
      // Defer any additional call out of the auth callback.
      setTimeout(() => void loadRbac(nextSession), 0);
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
      void loadRbac(data.session);
    });

    return () => sub.subscription.unsubscribe();
  }, [loadRbac]);

  const hasRole = (role: AppRole) => roles.includes(role);
  const isAdmin = roles.some((r) => ADMIN_ROLES.includes(r));
  const isEditor = hasRole("editor");
  const isStaff = isAdmin || isEditor;

  // Admin/super_admin mirror the backend's permission bypass for UX gating.
  const hasPermission = (key: PermissionKey) => isAdmin || permissions.includes(key);

  const signOut = async () => {
    rbacSeq.current++; // invalidate any in-flight RBAC request
    // Never let a network/expired-session error block sign-out: always clear
    // local state so the user is signed out in the UI regardless.
    try {
      await supabase.auth.signOut();
    } catch {
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch { /* already gone */ }
    }
    setSession(null);
    setUser(null);
    setRoles([]);
    setPermissions([]);
    setRbacLoaded(true);
  };

  const refreshAdmin = async () => {
    await loadRbac(session);
  };

  return (
    <Ctx.Provider
      value={{
        session,
        user,
        roles,
        rolesLoaded: rbacLoaded,
        permissions,
        permissionsLoaded: rbacLoaded,
        rbacLoaded,
        hasPermission,
        hasRole,
        isAdmin,
        isEditor,
        isStaff,
        loading,
        signOut,
        refreshAdmin,
      }}
    >
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
};
