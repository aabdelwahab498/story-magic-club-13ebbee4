import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface Props {
  /** If provided, requires user to have at least one of these roles. */
  requireStaff?: boolean;
  requireAdmin?: boolean;
}

const ProtectedRoute = ({ requireStaff, requireAdmin }: Props) => {
  const { t } = useTranslation();
  const { session, loading, isAdmin, isStaff } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" state={{ from: location.pathname }} replace />;
  }

  const allowed =
    (!requireStaff && !requireAdmin) ||
    (requireAdmin && isAdmin) ||
    (requireStaff && isStaff);

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center bg-card rounded-3xl shadow-soft p-8 border-2 border-destructive/30">
          <ShieldAlert className="h-12 w-12 text-destructive mx-auto mb-3" />
          <h2 className="text-2xl font-bold mb-2">
            {t("auth.access_denied_title", "Access denied")}
          </h2>
          <p className="text-muted-foreground mb-4">
            {t(
              "auth.access_denied_desc",
              "You need administrator privileges to view this page."
            )}
          </p>
          <Button asChild className="rounded-full">
            <Link to="/">{t("auth.back_home", "Back to home")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;
