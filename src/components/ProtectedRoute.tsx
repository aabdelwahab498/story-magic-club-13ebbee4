import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  /** If provided, requires user to have at least one of these roles. */
  requireStaff?: boolean;
  requireAdmin?: boolean;
}

/**
 * Route-group guard.
 *
 * Authorization order:
 *   1. Wait for auth state (session) to resolve.
 *   2. Unauthenticated visitors are redirected to the appropriate sign-in page.
 *   3. For staff/admin routes, wait until the user_roles query has resolved
 *      before making any role decision (prevents admin-content flash and
 *      incorrect redirects for valid admins).
 *   4. Enforce the role requirement. Denied users go to a safe, predictable
 *      destination ("/") instead of a redirect loop.
 *
 * This is defense-in-depth only — RLS and edge-function checks remain the
 * authoritative security layer.
 */
const ProtectedRoute = ({ requireStaff, requireAdmin }: Props) => {
  const { session, loading, rolesLoaded, isStaff, isAdmin } = useAuth();
  const location = useLocation();

  const needsRoles = Boolean(requireStaff || requireAdmin);

  if (loading || (session && needsRoles && !rolesLoaded)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    const target = needsRoles ? "/admin/auth" : "/auth";
    return <Navigate to={target} state={{ from: location.pathname }} replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" state={{ denied: location.pathname }} replace />;
  }

  if (requireStaff && !isStaff) {
    return <Navigate to="/" state={{ denied: location.pathname }} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
