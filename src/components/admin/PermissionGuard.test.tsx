import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import PermissionGuard from "./PermissionGuard";
import { useAuth } from "@/hooks/useAuth";
import { ADMIN_ROLES, type AppRole } from "@/lib/rbac";

vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (_k: string, d?: string) => d ?? _k }),
}));

const mockUseAuth = useAuth as unknown as ReturnType<typeof vi.fn>;

const setAuth = ({
  roles = [] as AppRole[],
  permissions = [] as string[],
  rbacLoaded = true,
}: { roles?: AppRole[]; permissions?: string[]; rbacLoaded?: boolean } = {}) => {
  const isAdmin = roles.some((r) => ADMIN_ROLES.includes(r));
  mockUseAuth.mockReturnValue({
    roles,
    permissions,
    rbacLoaded,
    rolesLoaded: rbacLoaded,
    permissionsLoaded: rbacLoaded,
    isAdmin,
    isEditor: roles.includes("editor"),
    isStaff: isAdmin || roles.includes("editor"),
    hasRole: (r: AppRole) => roles.includes(r),
    hasPermission: (k: string) => isAdmin || permissions.includes(k),
  });
};

const CHILD = "guarded-content";
const renderGuard = (props: Record<string, unknown> = {}) =>
  render(
    <MemoryRouter>
      <PermissionGuard permission="story.update" {...props}>
        <div>{CHILD}</div>
      </PermissionGuard>
    </MemoryRouter>,
  );

describe("PermissionGuard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows a normal user holding the required permission", () => {
    setAuth({ roles: ["user"], permissions: ["story.update"] });
    renderGuard();
    expect(screen.getByText(CHILD)).toBeInTheDocument();
  });

  it("denies a normal user without the permission", () => {
    setAuth({ roles: ["user"], permissions: ["story.read"] });
    renderGuard();
    expect(screen.queryByText(CHILD)).not.toBeInTheDocument();
    expect(screen.getByText("Access denied")).toBeInTheDocument();
  });

  it("allows an editor holding the permission", () => {
    setAuth({ roles: ["editor"], permissions: ["story.update"] });
    renderGuard();
    expect(screen.getByText(CHILD)).toBeInTheDocument();
  });

  it("denies an editor without the permission", () => {
    setAuth({ roles: ["editor"], permissions: [] });
    renderGuard();
    expect(screen.queryByText(CHILD)).not.toBeInTheDocument();
  });

  it("allows admin with empty permissions (backend bypass parity)", () => {
    setAuth({ roles: ["admin"], permissions: [] });
    renderGuard();
    expect(screen.getByText(CHILD)).toBeInTheDocument();
  });

  it("allows super_admin with empty permissions", () => {
    setAuth({ roles: ["super_admin"], permissions: [] });
    renderGuard();
    expect(screen.getByText(CHILD)).toBeInTheDocument();
  });

  it("allows admin on adminOnly sections", () => {
    setAuth({ roles: ["admin"] });
    renderGuard({ adminOnly: true, permission: undefined });
    expect(screen.getByText(CHILD)).toBeInTheDocument();
  });

  it("denies editor on adminOnly sections", () => {
    setAuth({ roles: ["editor"], permissions: ["story.update"] });
    renderGuard({ adminOnly: true, permission: undefined });
    expect(screen.queryByText(CHILD)).not.toBeInTheDocument();
  });

  it("renders neither content nor denial while RBAC is unresolved", () => {
    setAuth({ roles: ["admin"], rbacLoaded: false });
    renderGuard();
    expect(screen.queryByText(CHILD)).not.toBeInTheDocument();
    expect(screen.queryByText("Access denied")).not.toBeInTheDocument();
  });

  it("denies when /me failed (roles and permissions empty)", () => {
    setAuth({ roles: [], permissions: [] });
    renderGuard();
    expect(screen.queryByText(CHILD)).not.toBeInTheDocument();
  });

  it("denies a logged-out visitor", () => {
    setAuth({ roles: [], permissions: [] });
    renderGuard();
    expect(screen.queryByText(CHILD)).not.toBeInTheDocument();
  });
});
