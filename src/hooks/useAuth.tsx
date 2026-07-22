import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { authApi } from "@/api/auth.api";
import { MeResponse } from "@/api/auth.api";
import { AppRole, PermissionKey } from "@/lib/rbac";

/**
 * Authentication context providing session, user, and RBAC helpers.
 * Refactored to use NestJS API /auth/me instead of Supabase Auth.
 */
interface AuthCtx {
  session: any | null; // Kept for backwards compatibility
  user: any | null; // Kept for backwards compatibility
  roles: AppRole[];
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
  const [meData, setMeData] = useState<MeResponse | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  const fetchMe = async () => {
    try {
      const data = await authApi.getMe();
      setMeData(data);
    } catch (err) {
      setMeData(null);
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    fetchMe();
  }, []);

  const roles = meData?.roles || [];
  const permissions = meData?.permissions || [];

  const hasRole = (role: AppRole) => roles.includes(role);
  const hasPermission = (key: PermissionKey) => permissions.includes(key);

  const isAdmin = hasRole("admin");
  const isEditor = hasRole("editor");
  const isStaff = isAdmin || isEditor;

  const signOut = async () => {
    try {
      await authApi.signOut();
    } finally {
      setMeData(null);
    }
  };

  const refreshAdmin = async () => {
    await fetchMe();
  };

  // Map MeResponse to legacy user object format to avoid breaking UI components
  const user = meData ? {
    id: meData.id,
    email: meData.email,
    user_metadata: { display_name: meData.email?.split("@")[0] || "" }
  } : null;

  // Mock session object
  const session = user ? { user } : null;

  return (
    <Ctx.Provider
      value={{
        session,
        user,
        roles,
        permissions,
        hasPermission,
        hasRole,
        isAdmin,
        isEditor,
        isStaff,
        loading: authLoading,
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
