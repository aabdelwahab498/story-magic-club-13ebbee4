import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ProtectedRoute from "./ProtectedRoute";
import { useAuth } from "@/hooks/useAuth";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

const mockUseAuth = useAuth as unknown as ReturnType<typeof vi.fn>;

interface MockAuthOptions {
  session?: object | null;
  loading?: boolean;
  rolesLoaded?: boolean;
  roles?: string[];
}

const setAuth = ({
  session = { user: { id: "u1" } },
  loading = false,
  rolesLoaded = true,
  roles = [],
}: MockAuthOptions = {}) => {
  const isAdmin = roles.includes("admin");
  const isEditor = roles.includes("editor");
  mockUseAuth.mockReturnValue({
    session,
    user: session ? { id: "u1" } : null,
    roles,
    rolesLoaded,
    permissions: [],
    hasPermission: () => isAdmin,
    hasRole: (r: string) => roles.includes(r),
    isAdmin,
    isEditor,
    isStaff: isAdmin || isEditor,
    loading,
    signOut: vi.fn(),
    refreshAdmin: vi.fn(),
  });
};

const PROTECTED_TEXT = "protected-content";
const HOME_TEXT = "home-page";
const AUTH_TEXT = "auth-page";
const ADMIN_AUTH_TEXT = "admin-auth-page";

const LocationProbe = () => {
  const location = useLocation();
  return (
    <div>
      <span>{location.pathname}</span>
      <span data-testid="nav-state">{JSON.stringify(location.state)}</span>
    </div>
  );
};

const renderRoutes = (
  element: React.ReactElement,
  initialPath = "/protected",
) =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<div>{HOME_TEXT}</div>} />
        <Route path="/auth" element={<div>{AUTH_TEXT}</div>} />
        <Route path="/admin/auth" element={<div>{ADMIN_AUTH_TEXT}</div>} />
        <Route element={element}>
          <Route path="/protected" element={<div>{PROTECTED_TEXT}</div>} />
          <Route
            path="/protected-state"
            element={
              <div>
                {PROTECTED_TEXT}
                <LocationProbe />
              </div>
            }
          />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("denies unauthenticated visitor on a normal protected route (→ /auth)", () => {
    setAuth({ session: null });
    renderRoutes(<ProtectedRoute />);
    expect(screen.getByText(AUTH_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(PROTECTED_TEXT)).not.toBeInTheDocument();
  });

  it("denies unauthenticated visitor on an admin route (→ /admin/auth)", () => {
    setAuth({ session: null });
    renderRoutes(<ProtectedRoute requireAdmin />);
    expect(screen.getByText(ADMIN_AUTH_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(PROTECTED_TEXT)).not.toBeInTheDocument();
  });

  it("denies unauthenticated visitor on a staff route (→ /admin/auth)", () => {
    setAuth({ session: null });
    renderRoutes(<ProtectedRoute requireStaff />);
    expect(screen.getByText(ADMIN_AUTH_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(PROTECTED_TEXT)).not.toBeInTheDocument();
  });

  it("allows authenticated normal user on a normal protected route", () => {
    setAuth({ roles: ["user"] });
    renderRoutes(<ProtectedRoute />);
    expect(screen.getByText(PROTECTED_TEXT)).toBeInTheDocument();
  });

  it("denies authenticated normal user on a staff route", () => {
    setAuth({ roles: ["user"] });
    renderRoutes(<ProtectedRoute requireStaff />);
    expect(screen.getByText(HOME_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(PROTECTED_TEXT)).not.toBeInTheDocument();
  });

  it("denies authenticated normal user on an admin route", () => {
    setAuth({ roles: ["user"] });
    renderRoutes(<ProtectedRoute requireAdmin />);
    expect(screen.getByText(HOME_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(PROTECTED_TEXT)).not.toBeInTheDocument();
  });

  it("allows editor on a staff route", () => {
    setAuth({ roles: ["editor"] });
    renderRoutes(<ProtectedRoute requireStaff />);
    expect(screen.getByText(PROTECTED_TEXT)).toBeInTheDocument();
  });

  it("denies editor on an admin route", () => {
    setAuth({ roles: ["editor"] });
    renderRoutes(<ProtectedRoute requireAdmin />);
    expect(screen.getByText(HOME_TEXT)).toBeInTheDocument();
    expect(screen.queryByText(PROTECTED_TEXT)).not.toBeInTheDocument();
  });

  it("allows admin on a staff route", () => {
    setAuth({ roles: ["admin"] });
    renderRoutes(<ProtectedRoute requireStaff />);
    expect(screen.getByText(PROTECTED_TEXT)).toBeInTheDocument();
  });

  it("allows admin on an admin route", () => {
    setAuth({ roles: ["admin"] });
    renderRoutes(<ProtectedRoute requireAdmin />);
    expect(screen.getByText(PROTECTED_TEXT)).toBeInTheDocument();
  });

  it("does not render child content while auth is loading", () => {
    setAuth({ session: null, loading: true });
    renderRoutes(<ProtectedRoute requireAdmin />);
    expect(screen.queryByText(PROTECTED_TEXT)).not.toBeInTheDocument();
    expect(screen.queryByText(ADMIN_AUTH_TEXT)).not.toBeInTheDocument();
  });

  it("does not render admin content or redirect while roles are still loading", () => {
    setAuth({ roles: ["admin"], rolesLoaded: false });
    renderRoutes(<ProtectedRoute requireAdmin />);
    expect(screen.queryByText(PROTECTED_TEXT)).not.toBeInTheDocument();
    expect(screen.queryByText(HOME_TEXT)).not.toBeInTheDocument();
    expect(screen.queryByText(ADMIN_AUTH_TEXT)).not.toBeInTheDocument();
  });

  it("does not flash protected content before authorization resolves", () => {
    // Roles unresolved: nothing privileged may render.
    setAuth({ roles: ["user"], rolesLoaded: false });
    const { rerender } = renderRoutes(<ProtectedRoute requireStaff />);
    expect(screen.queryByText(PROTECTED_TEXT)).not.toBeInTheDocument();

    // Roles resolve to a non-staff user: deny, never flash content.
    setAuth({ roles: ["user"], rolesLoaded: true });
    rerender(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route path="/" element={<div>{HOME_TEXT}</div>} />
          <Route element={<ProtectedRoute requireStaff />}>
            <Route path="/protected" element={<div>{PROTECTED_TEXT}</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.queryByText(PROTECTED_TEXT)).not.toBeInTheDocument();
  });

  it("preserves the requested location in navigation state when redirecting to sign-in", () => {
    setAuth({ session: null });
    render(
      <MemoryRouter initialEntries={["/protected-state"]}>
        <Routes>
          <Route
            path="/auth"
            element={
              <div>
                {AUTH_TEXT}
                <LocationProbe />
              </div>
            }
          />
          <Route element={<ProtectedRoute />}>
            <Route path="/protected-state" element={<div>{PROTECTED_TEXT}</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText(AUTH_TEXT)).toBeInTheDocument();
    expect(screen.getByTestId("nav-state").textContent).toContain(
      "/protected-state",
    );
  });
});
