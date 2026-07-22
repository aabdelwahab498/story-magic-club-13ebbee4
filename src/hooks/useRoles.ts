// src/hooks/useRoles.ts
import { useState, useEffect, useCallback } from 'react';
import { AppRole, PermissionKey } from '@/lib/rbac';
import { authApi } from '@/api/auth.api';

/**
 * Hook to load a user's roles and permissions once per authenticated session.
 * It caches the results and provides helper functions for RBAC checks.
 */
export function useRoles(userId: string | undefined) {
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [permissions, setPermissions] = useState<PermissionKey[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchRolesAndPermissions = useCallback(async () => {
    if (!userId) {
      setRoles([]);
      setPermissions([]);
      setLoading(false);
      return;
    }

    try {
      const me = await authApi.getMe();
      setRoles(me.roles);
      setPermissions(me.permissions);
    } catch (error) {
      console.error('Failed to fetch user roles from backend', error);
      setRoles([]);
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Initial load and reload when userId changes
  useEffect(() => {
    setLoading(true);
    fetchRolesAndPermissions();
  }, [fetchRolesAndPermissions]);

  // Helper functions
  const hasRole = useCallback((role: AppRole) => roles.includes(role), [roles]);

  const hasPermission = useCallback(
    (key: PermissionKey) => {
      if (roles.includes('admin')) return true; // admin shortcut
      return permissions.includes(key);
    },
    [roles, permissions]
  );

  // Refresh function for manual reloads (e.g., after role change)
  const refresh = useCallback(() => {
    setLoading(true);
    fetchRolesAndPermissions();
  }, [fetchRolesAndPermissions]);

  return { roles, permissions, loading, hasRole, hasPermission, refresh };
}
