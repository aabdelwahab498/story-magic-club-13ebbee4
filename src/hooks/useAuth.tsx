import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "editor" | "user";

interface AuthCtx {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  permissions: string[];
  hasPermission: (key: string) => boolean;
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
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const checkRoles = async (userId: string | undefined) => {
    if (!userId) {
      setRoles([]);
      setPermissions([]);
      return;
    }
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const userRoles = ((roleRows ?? []) as { role: AppRole }[]).map((r) => r.role);
    setRoles(userRoles);

    if (userRoles.length === 0) {
      setPermissions([]);
      return;
    }
    const { data: permRows } = await supabase
      .from("rbac_permissions")
      .select("permission_key, granted, role")
      .in("role", userRoles as unknown as ("admin" | "editor" | "user")[])
      .eq("granted", true);
    const perms = Array.from(
      new Set(((permRows ?? []) as { permission_key: string }[]).map((p) => p.permission_key))
    );
    setPermissions(perms);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setTimeout(() => checkRoles(sess?.user?.id), 0);
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      checkRoles(data.session?.user?.id).finally(() => setLoading(false));
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshAdmin = async () => {
    await checkRoles(session?.user?.id);
  };

  const isAdmin = roles.includes("admin");
  const isEditor = roles.includes("editor");
  const isStaff = isAdmin || isEditor;

  const hasPermission = (key: string) => isAdmin || permissions.includes(key);

  return (
    <Ctx.Provider
      value={{
        session,
        user: session?.user ?? null,
        roles,
        permissions,
        hasPermission,
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
