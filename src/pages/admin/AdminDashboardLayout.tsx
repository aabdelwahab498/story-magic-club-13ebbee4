import { useEffect } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  LayoutDashboard,
  BookOpen,
  Video,
  FileText,
  Languages,
  Settings,
  Loader2,
  ArrowLeft,
  Sparkles,
  CreditCard,
  Wallet,
  ShoppingBag,
  Package,
  Webhook,
  Crown,
  Bot,
  Activity,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeToggle from "@/components/ThemeToggle";

const navItems = [
  { titleKey: "admin_dashboard.nav.dashboard", url: "/admin/dashboard", icon: LayoutDashboard, gradient: "from-primary to-primary-glow", labelFallback: "Dashboard" },
  { titleKey: "admin_dashboard.nav.stories", url: "/admin/dashboard/stories", icon: BookOpen, gradient: "from-kids-pink to-kids-purple", labelFallback: "Stories" },
  { titleKey: "admin_dashboard.nav.story_engine", url: "/admin/dashboard/story-engine", icon: Sparkles, gradient: "from-fuchsia-500 to-violet-500", labelFallback: "Story Engine" },
  { titleKey: "admin_dashboard.nav.ai_models", url: "/admin/dashboard/ai-models", icon: Bot, gradient: "from-violet-500 to-indigo-500", labelFallback: "AI Models" },
  { titleKey: "admin_dashboard.nav.illustration_analytics", url: "/admin/dashboard/illustration-analytics", icon: Activity, gradient: "from-sky-500 to-cyan-500", labelFallback: "Illustration Analytics" },
  { titleKey: "admin_dashboard.nav.ai_usage", url: "/admin/dashboard/ai-usage", icon: Activity, gradient: "from-emerald-500 to-teal-500", labelFallback: "AI Usage" },
  { titleKey: "admin_dashboard.nav.videos", url: "/admin/dashboard/videos", icon: Video, gradient: "from-kids-blue to-accent", labelFallback: "Videos" },
  { titleKey: "admin_dashboard.nav.blog", url: "/admin/dashboard/blog", icon: FileText, gradient: "from-kids-purple to-kids-pink", labelFallback: "Blog" },
  { titleKey: "admin_dashboard.nav.products", url: "/admin/dashboard/products", icon: ShoppingBag, gradient: "from-amber-400 to-orange-500", labelFallback: "Products" },
  { titleKey: "admin_dashboard.nav.orders", url: "/admin/dashboard/orders", icon: Package, gradient: "from-rose-500 to-orange-500", labelFallback: "Orders" },
  { titleKey: "admin_dashboard.nav.payments", url: "/admin/dashboard/payments", icon: CreditCard, gradient: "from-emerald-500 to-teal-500", labelFallback: "Payments" },
  { titleKey: "admin_dashboard.nav.subscriptions", url: "/admin/dashboard/subscriptions", icon: Activity, gradient: "from-teal-500 to-cyan-500", labelFallback: "Subscriptions Status" },
  { titleKey: "admin_dashboard.nav.webhook_logs", url: "/admin/dashboard/webhook-logs", icon: Webhook, gradient: "from-indigo-500 to-violet-500", labelFallback: "Webhook Logs" },
  { titleKey: "admin_dashboard.nav.payment_settings", url: "/admin/dashboard/payment-settings", icon: Wallet, gradient: "from-amber-500 to-orange-500", labelFallback: "Payment Settings" },
  { titleKey: "admin_dashboard.nav.plans", url: "/admin/dashboard/plans", icon: Crown, gradient: "from-fuchsia-500 to-pink-500", labelFallback: "Subscription Plans" },
  { titleKey: "admin_dashboard.nav.languages", url: "/admin/dashboard/languages", icon: Languages, gradient: "from-kids-green to-kids-blue", labelFallback: "Languages" },
  { titleKey: "admin_dashboard.nav.settings", url: "/admin/dashboard/settings", icon: Settings, gradient: "from-kids-orange to-kids-yellow", labelFallback: "Settings" },
];

const AdminSidebar = () => {
  const { t } = useTranslation();
  const { state } = useSidebar();
  const location = useLocation();
  const collapsed = state === "collapsed";
  const labelFor = (item: { titleKey: string; labelFallback?: string }) => {
    return t(item.titleKey, item.labelFallback ?? "");
  };

  return (
    <Sidebar collapsible="icon" className="border-r-2 border-kids-softPurple/60 dark:border-primary/20">
      <SidebarContent className="bg-gradient-to-b from-white/95 to-kids-softPurple/40 dark:from-card/95 dark:to-background/80 backdrop-blur">
        <div className="flex items-center gap-2 px-4 pt-5 pb-3">
          <div className="h-10 w-10 rounded-2xl bg-magic flex items-center justify-center text-primary-foreground font-bold shadow-glow animate-pop">
            <Sparkles className="h-5 w-5" />
          </div>
          {!collapsed && (
            <span className="font-bold bg-magic bg-clip-text text-transparent text-lg">
              {t("admin_dashboard.brand")}
            </span>
          )}
        </div>
        <SidebarGroup>
          <SidebarGroupLabel className="font-bold text-muted-foreground/80">
            {t("admin_dashboard.nav.section")}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1.5">
              {navItems.map((item) => {
                const active =
                  location.pathname === item.url ||
                  (item.url !== "/admin/dashboard" &&
                    location.pathname.startsWith(item.url));
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={labelFor(item)}
                      className={`rounded-xl transition-all duration-300 ${
                        active
                          ? `bg-gradient-to-r ${item.gradient} text-white shadow-soft hover:opacity-90`
                          : "hover:bg-kids-softPurple/40 dark:hover:bg-primary/10 hover:translate-x-1"
                      }`}
                    >
                      <NavLink to={item.url} end={item.url === "/admin/dashboard"}>
                        <item.icon className={`h-4 w-4 ${active ? "animate-bounce-gentle" : ""}`} />
                        {!collapsed && <span className="font-semibold">{labelFor(item)}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};

export default function AdminDashboardLayout() {
  const { t, i18n } = useTranslation();
  const { isStaff, isAdmin, isEditor, loading, session } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const isAr = i18n.language?.startsWith("ar");

  useEffect(() => {
    if (!loading && !session) {
      navigate("/auth", { replace: true });
    }
  }, [loading, session, navigate]);

  if (loading) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isStaff) {
    return (
      <div className="min-h-svh flex items-center justify-center px-4">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">{t("admin_dashboard.no_access_title")}</h1>
          <p className="text-muted-foreground">{t("admin_dashboard.no_access_desc")}</p>
          <Button onClick={() => navigate("/admin")}>
            {t("admin_dashboard.go_to_admin")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div
        dir="ltr"
        className={`min-h-svh flex w-full font-comic relative overflow-hidden transition-colors duration-500 ${
          theme === "dark"
            ? "bg-gradient-to-br from-[hsl(240,60%,6%)] via-[hsl(260,55%,10%)] to-[hsl(220,60%,8%)]"
            : "bg-gradient-to-br from-kids-softPurple/40 via-background to-kids-softBlue/30"
        }`}
      >
        {theme === "dark" && <div className="starry-sky fixed inset-0 -z-10" />}
        <AdminSidebar />
        <div dir={isAr ? "rtl" : "ltr"} className="flex-1 flex flex-col min-w-0 relative z-10">
          <header className="h-16 border-b-2 border-kids-softPurple/40 dark:border-primary/20 bg-white/80 dark:bg-card/70 backdrop-blur flex items-center gap-3 px-4 sticky top-0 z-20 shadow-soft">
            <SidebarTrigger className="hover:bg-kids-softPurple/50 dark:hover:bg-primary/10 rounded-full" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="gap-2 rounded-full"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{t("admin_dashboard.back_to_site")}</span>
            </Button>
            <div className="flex-1" />
            <Badge
              variant={isAdmin ? "default" : "secondary"}
              className={`rounded-full px-3 py-1 ${
                isAdmin
                  ? "bg-magic text-primary-foreground border-0 shadow-soft"
                  : ""
              }`}
            >
              {isAdmin
                ? t("admin_dashboard.role.admin")
                : t("admin_dashboard.role.editor")}
            </Badge>
            <ThemeToggle />
            <LanguageSwitcher />
          </header>
          <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-x-hidden overflow-y-auto animate-fade-in">
            <Outlet context={{ isAdmin, isEditor }} />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
