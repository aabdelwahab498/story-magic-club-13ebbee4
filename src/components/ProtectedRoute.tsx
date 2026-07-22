import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  /** If provided, requires user to have at least one of these roles. */
  requireStaff?: boolean;
  requireAdmin?: boolean;
}

const ProtectedRoute = ({ requireStaff, requireAdmin }: Props) => {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    const target = requireStaff || requireAdmin ? "/admin/auth" : "/auth";
    return <Navigate to={target} state={{ from: location.pathname }} replace />;
  }





  return <Outlet />;
};

export default ProtectedRoute;
