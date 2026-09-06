import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { AppRole, PermissionKey } from "@/lib/rbac";

/**
 * Authentication context backed by Lovable Cloud auth.
 * Roles are read from the `user_roles` table (never from the profile row).
 */
interface AuthCtx {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  /** True once the user_roles query has resolved (or no user is signed in). */
  rolesLoaded: boolean;
  permissions: PermissionKey[];
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
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadRoles = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setRoles([]);
      setRolesLoaded(true);
      return;
    }
    // Mark unresolved until the user_roles query completes so route guards
    // never make an authorization decision on a stale/empty role list.
    setRolesLoaded(false);
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (error) throw error;
      setRoles(((data ?? []) as { role: AppRole }[]).map((r) => r.role));
    } catch {
      setRoles([]);
    } finally {
      setRolesLoaded(true);
    }
  }, []);

  useEffect(() => {
    // Register the listener first, then read the existing session.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
      // Defer any additional Supabase call out of the callback.
      setTimeout(() => void loadRoles(nextSession?.user?.id), 0);
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
      void loadRoles(data.session?.user?.id);
    });

    return () => sub.subscription.unsubscribe();
  }, [loadRoles]);

  const hasRole = (role: AppRole) => roles.includes(role);
  const isAdmin = hasRole("admin");
  const isEditor = hasRole("editor");
  const isStaff = isAdmin || isEditor;

  // Permissions are role-derived for now; admins implicitly hold every key.
  const permissions: PermissionKey[] = [];
  const hasPermission = (key: PermissionKey) => isAdmin || permissions.includes(key);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRoles([]);
  };

  const refreshAdmin = async () => {
    await loadRoles(user?.id);
  };

  return (
    <Ctx.Provider
      value={{
        session,
        user,
        roles,
        rolesLoaded,
        permissions,
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
