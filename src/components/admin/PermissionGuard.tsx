import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ShieldAlert, ArrowLeft, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

import { PermissionKey } from "@/lib/rbac";

interface Props {
  /** Required permission key. Admins always pass. */
  permission?: PermissionKey;
  /** If true, only full admins pass (editors blocked). */
  adminOnly?: boolean;
  /** Friendly section label for the error UI. */
  sectionLabel?: string;
  children: ReactNode;
}

/**
 * Wrap an admin route element with this to enforce a specific RBAC permission.
 * Shows a clean Access Denied screen instead of crashing or empty page.
 */
export default function PermissionGuard({
  permission,
  adminOnly,
  sectionLabel,
  children,
}: Props) {
  const { t } = useTranslation();
  const { isAdmin, hasPermission, roles, rbacLoaded } = useAuth();

  // Never decide (or flash privileged UI) before RBAC resolves.
  if (!rbacLoaded) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const allowed = adminOnly
    ? isAdmin
    : !permission || isAdmin || hasPermission(permission);

  if (allowed) return <>{children}</>;

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-card/95 backdrop-blur rounded-3xl shadow-2xl p-8 border-2 border-destructive/30 text-center space-y-4">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-destructive/15 flex items-center justify-center">
          <ShieldAlert className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="text-2xl font-bold">
          {t("admin_access_denied.title", "Access denied")}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t(
            "admin_access_denied.desc",
            "You don't have the required permission to view this section."
          )}
        </p>
        <div className="rounded-xl border-2 border-muted bg-muted/30 p-3 text-xs space-y-1 text-left">
          {sectionLabel && (
            <div>
              <span className="font-semibold">
                {t("admin_access_denied.section", "Section")}:
              </span>{" "}
              {sectionLabel}
            </div>
          )}
          {permission && (
            <div className="flex items-center gap-1">
              <KeyRound className="h-3 w-3 text-primary" />
              <span className="font-semibold">
                {t("admin_access_denied.required", "Required")}:
              </span>{" "}
              <code className="bg-background/60 px-1.5 py-0.5 rounded">{permission}</code>
            </div>
          )}
          <div>
            <span className="font-semibold">
              {t("admin_access_denied.your_roles", "Your roles")}:
            </span>{" "}
            {roles.length ? roles.join(", ") : t("admin_access_denied.none", "none")}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {t(
            "admin_access_denied.hint",
            "Ask an administrator to grant the required permission, or return to the dashboard."
          )}
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/admin/dashboard">
              <ArrowLeft className="h-4 w-4 mr-1" />
              {t("admin_access_denied.back_dashboard", "Back to dashboard")}
            </Link>
          </Button>
          <Button asChild variant="ghost" className="rounded-full">
            <Link to="/">{t("auth.back_home", "Back to home")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
