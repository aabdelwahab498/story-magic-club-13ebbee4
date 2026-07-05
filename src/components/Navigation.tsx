import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BookOpen,
  Sparkles,
  Brush,
  Home,
  Shield,
  LogIn,
  LogOut,
  Menu,
  X,
  LayoutDashboard,
  Newspaper,
  ShoppingBag,
  Mail,
  Crown,
  ChevronDown,
  Compass,
  Users,
  Store as StoreIcon,
  UserPlus,
  User as UserIcon,
  BookMarked,
  KeyRound,
  Settings as SettingsIcon,
  GraduationCap,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useProfile } from "@/hooks/useProfile";
import { useState } from "react";
import LanguageSwitcher from "./LanguageSwitcher";
import ThemeToggle from "./ThemeToggle";
import { NotificationBell } from "./NotificationBell";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import najmahLogoFull from "@/assets/najmah-logo-full.webp";
import StreakBadge from "./StreakBadge";
import CreditCounter from "./CreditCounter";
import SocialMediaIcons from "./SocialMediaIcons";
import ChildPicker from "./ChildPicker";
import InstallPwaButton from "./InstallPwaButton";

type NavItem = { to: string; labelKey: string; icon: typeof Home };

const Navigation = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, isStaff, signOut } = useAuth();
  const { profile } = useProfile();
  const [open, setOpen] = useState(false);
  const sfx = useSoundEffects();

  const isActivePath = (path: string) => location.pathname === path;

  const activePill = (active: boolean) =>
    active
      ? "bg-primary text-primary-foreground shadow-soft"
      : "hover:bg-accent/50 hover:scale-105";

  const groups: { labelKey: string; icon: typeof Home; items: NavItem[] }[] = [
    {
      labelKey: "nav.group_explore",
      icon: Compass,
      items: [
        { to: "/stories", labelKey: "nav.stories", icon: BookOpen },
        { to: "/ai-storyteller", labelKey: "nav.ai_storyteller", icon: Sparkles },
        { to: "/drawing-competition", labelKey: "nav.drawing_contest", icon: Brush },
      ],
    },
    {
      labelKey: "nav.group_community",
      icon: Users,
      items: [
        { to: "/blog", labelKey: "nav.blog", icon: Newspaper },
        { to: "/contact", labelKey: "nav.contact", icon: Mail },
      ],
    },
    {
      labelKey: "nav.group_shop",
      icon: StoreIcon,
      items: [
        { to: "/store", labelKey: "nav.store", icon: ShoppingBag },
        { to: "/store?product=storytelling-course", labelKey: "nav.storytelling_course", icon: GraduationCap },
        { to: "/pricing", labelKey: "nav.pricing", icon: Crown },
      ],
    },

  ];

  const isGroupActive = (items: NavItem[]) =>
    items.some((i) => isActivePath(i.to));

  const closeMobile = () => setOpen(false);

  return (
    <nav className="bg-white/70 dark:bg-card/70 backdrop-blur-md shadow-soft py-3 px-4 sm:px-6 rounded-b-3xl border-b-2 border-kids-softPurple/40 dark:border-primary/30 sticky top-0 z-40">
      <div className="container mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 group" onMouseEnter={sfx.onMouseEnter} onClick={sfx.onClick}>
            <img
              src={najmahLogoFull}
              alt={t("app.name")}
              className="h-10 sm:h-14 w-auto object-contain group-hover:animate-wiggle drop-shadow-md"
            />
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          className="lg:hidden p-2 rounded-full hover:bg-accent/50 transition-transform hover:scale-110"
          onClick={() => {
            sfx.playSound("click");
            setOpen((o) => !o);
          }}
          onMouseEnter={sfx.onMouseEnter}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <div
          className={`${open ? "flex" : "hidden"} lg:flex flex-col lg:flex-row lg:items-center w-full lg:w-auto gap-2 mt-3 lg:mt-0 lg:flex-1 lg:justify-end`}
        >
          <div className="flex flex-wrap lg:flex-nowrap justify-center items-center gap-1.5">
            {/* Home — always visible */}
            <Link
              to="/"
              onMouseEnter={sfx.onMouseEnter}
              onClick={() => {
                sfx.playSound("click");
                closeMobile();
              }}
              className={`px-3 py-2 rounded-full transition-all duration-300 flex items-center text-sm ${activePill(isActivePath("/"))}`}
            >
              <Home className="h-4 w-4 me-1" />
              <span>{t("nav.home")}</span>
            </Link>

            {/* About — always visible */}
            <Link
              to="/about"
              onMouseEnter={sfx.onMouseEnter}
              onClick={() => {
                sfx.playSound("click");
                closeMobile();
              }}
              className={`px-3 py-2 rounded-full transition-all duration-300 flex items-center text-sm ${activePill(isActivePath("/about"))}`}
            >
              <GraduationCap className="h-4 w-4 me-1" />
              <span>{t("nav.about", "About")}</span>
            </Link>

            {/* Desktop: grouped dropdowns */}
            <div className="hidden lg:flex items-center gap-1.5">
              {groups.map(({ labelKey, icon: GroupIcon, items }) => {
                const active = isGroupActive(items);
                return (
                  <DropdownMenu key={labelKey}>
                    <DropdownMenuTrigger
                      onMouseEnter={sfx.onMouseEnter}
                      className={`px-3 py-2 rounded-full transition-all duration-300 flex items-center text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring ${activePill(active)}`}
                    >
                      <GroupIcon className="h-4 w-4 me-1" />
                      <span>{t(labelKey)}</span>
                      <ChevronDown className="h-3.5 w-3.5 ms-1 opacity-70" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="center"
                      className="rounded-2xl border-2 border-kids-softPurple/40 dark:border-primary/30 shadow-soft"
                    >
                      <DropdownMenuLabel className="text-xs uppercase tracking-wide opacity-70">
                        {t(labelKey)}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {items.map(({ to, labelKey: itemKey, icon: Icon }) => (
                        <DropdownMenuItem
                          key={to}
                          asChild
                          onSelect={() => sfx.playSound("click")}
                        >
                          <Link
                            to={to}
                            className={`flex items-center gap-2 rounded-lg cursor-pointer ${
                              isActivePath(to) ? "bg-accent/60 font-semibold" : ""
                            }`}
                          >
                            <Icon className="h-4 w-4" />
                            <span>{t(itemKey)}</span>
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              })}
            </div>

            {/* Mobile: flat list of all items grouped by label */}
            <div className="lg:hidden flex flex-col w-full gap-2">
              {groups.map(({ labelKey, items }) => (
                <div key={labelKey} className="flex flex-col gap-1">
                  <p className="px-3 pt-2 text-xs uppercase tracking-wide opacity-60 font-bold">
                    {t(labelKey)}
                  </p>
                  {items.map(({ to, labelKey: itemKey, icon: Icon }) => (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => {
                        sfx.playSound("click");
                        closeMobile();
                      }}
                      className={`px-3 py-2 rounded-full transition-all duration-300 flex items-center text-sm ${activePill(isActivePath(to))}`}
                    >
                      <Icon className="h-4 w-4 me-2" />
                      <span>{t(itemKey)}</span>
                    </Link>
                  ))}
                </div>
              ))}
            </div>

            {isAdmin && (
              <Link
                to="/admin"
                onClick={closeMobile}
                title={t("nav.admin")}
                className={`px-3 py-2 rounded-full transition-all duration-300 flex items-center text-sm ${activePill(isActivePath("/admin"))}`}
              >
                <Shield className="h-4 w-4 lg:me-1" />
                <span className="lg:hidden 2xl:inline">{t("nav.admin")}</span>
              </Link>
            )}
            {isStaff && (
              <Link
                to="/admin/dashboard"
                onClick={closeMobile}
                title={t("nav.dashboard")}
                className={`px-3 py-2 rounded-full transition-all duration-300 flex items-center text-sm ${
                  location.pathname.startsWith("/admin/dashboard")
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-accent/40"
                }`}
              >
                <LayoutDashboard className="h-4 w-4 lg:me-1" />
                <span className="lg:hidden 2xl:inline">{t("nav.dashboard")}</span>
              </Link>
            )}
          </div>

          <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 justify-center">
            <ChildPicker />
            <CreditCounter />
            <StreakBadge />
            <InstallPwaButton variant="compact" className="hidden md:inline-flex" />
            <ThemeToggle />
            <LanguageSwitcher />
            {user && <NotificationBell />}
            {user && isStaff && (
              <span className="hidden 2xl:inline-flex items-center gap-1 rounded-full bg-magic px-2.5 py-1 text-xs font-bold text-primary-foreground shadow-soft">
                <Shield className="h-3 w-3" />
                {isAdmin ? t("nav.role_admin", "Admin") : t("nav.role_editor", "Editor")}
              </span>
            )}
            {user ? (() => {
              const displayName =
                profile?.display_name ||
                (user.user_metadata as { display_name?: string } | undefined)?.display_name ||
                user.email?.split("@")[0] ||
                "";
              const avatarUrl =
                profile?.avatar_url ||
                (user.user_metadata as { avatar_url?: string } | undefined)?.avatar_url ||
                null;
              const initial = (displayName || user.email || "?").charAt(0).toUpperCase();
              return (
              <DropdownMenu>
                <DropdownMenuTrigger
                  onMouseEnter={sfx.onMouseEnter}
                  className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 border-2 border-primary/30 hover:border-primary/60 bg-gradient-to-r from-primary/10 to-accent/10 hover:from-primary/20 hover:to-accent/20 transition-all shadow-soft outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  title={user.email ?? ""}
                >
                  <Avatar className="h-8 w-8 ring-2 ring-primary/40">
                    {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
                    <AvatarFallback className="bg-magic text-primary-foreground text-sm font-bold">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden md:inline text-sm font-semibold max-w-[140px] truncate">
                    {displayName}
                  </span>
                  <ChevronDown className="h-4 w-4 opacity-70" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-2xl border-2 border-kids-softPurple/40 dark:border-primary/30 shadow-soft">
                  <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/account/profile" className="cursor-pointer gap-2">
                      <UserIcon className="h-4 w-4" /> {t("nav.profile", "Profile")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/my-stories" className="cursor-pointer gap-2">
                      <BookMarked className="h-4 w-4" /> {t("nav.my_stories", "My stories")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/account/subscription" className="cursor-pointer gap-2">
                      <Crown className="h-4 w-4 text-amber-500" /> {t("nav.my_subscription", "My subscription")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/account/api-keys" className="cursor-pointer gap-2">
                      <KeyRound className="h-4 w-4" /> {t("nav.api_keys", "API keys")}
                    </Link>
                  </DropdownMenuItem>
                  {isStaff && (
                    <DropdownMenuItem asChild>
                      <Link to="/admin/dashboard" className="cursor-pointer gap-2">
                        <SettingsIcon className="h-4 w-4" /> {t("nav.dashboard", "Dashboard")}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={async () => {
                      await signOut();
                      navigate("/");
                    }}
                    className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                  >
                    <LogOut className="h-4 w-4" /> {t("nav.sign_out")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              );
            })() : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/auth", { state: { from: `${location.pathname}${location.search}` } })}
                  className="rounded-full border-2 border-primary/40 hover:border-primary"
                >
                  <LogIn className="h-4 w-4 me-1" />
                  {t("nav.sign_in")}
                </Button>
                <Button
                  size="sm"
                  onClick={() => navigate("/auth?mode=signup", { state: { from: `${location.pathname}${location.search}` } })}
                  className="rounded-full bg-magic text-primary-foreground shadow-glow hover:opacity-95 font-bold"
                >
                  <UserPlus className="h-4 w-4 me-1" />
                  {t("nav.sign_up", "Sign up")}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
