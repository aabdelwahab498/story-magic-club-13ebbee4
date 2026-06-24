import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Loader2 } from "lucide-react";
import "@/i18n/config";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { AdminDataSourceProvider } from "@/hooks/useAdminDataSource";
import { useBedtimeAutoTheme } from "@/hooks/useBedtimeAutoTheme";
import Layout from "./components/Layout";
import Index from "./pages/Index";
import ProtectedRoute from "./components/ProtectedRoute";
import { AudioDebugPanel } from "@/components/AudioDebugPanel";
import PermissionGuard from "@/components/admin/PermissionGuard";

// Lazy-load every non-home route so the initial bundle stays small.
// This is the single biggest win for first-paint performance.
const StoryLibrary = lazy(() => import("./pages/StoryLibrary"));
const StoryDetail = lazy(() => import("./pages/StoryDetail"));
const AIStoryteller = lazy(() => import("./pages/AIStoryteller"));
const DrawingCompetition = lazy(() => import("./pages/DrawingCompetition"));
const Auth = lazy(() => import("./pages/Auth"));
const AdminAuth = lazy(() => import("./pages/AdminAuth"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Admin = lazy(() => import("./pages/Admin"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const BlogSubmit = lazy(() => import("./pages/BlogSubmit"));
const Store = lazy(() => import("./pages/Store"));
const Contact = lazy(() => import("./pages/Contact"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Family = lazy(() => import("./pages/Family"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const ParentDashboard = lazy(() => import("./pages/ParentDashboard"));
const AdminDashboardLayout = lazy(() => import("./pages/admin/AdminDashboardLayout"));
const AdminDashboardOverview = lazy(() => import("./pages/admin/AdminDashboardOverview"));
const AdminStoriesPage = lazy(() => import("./pages/admin/AdminStoriesPage"));
const AdminVideosPage = lazy(() => import("./pages/admin/AdminVideosPage"));
const AdminBlogPage = lazy(() => import("./pages/admin/AdminBlogPage"));
const AdminLanguagesPage = lazy(() => import("./pages/admin/AdminLanguagesPage"));
const AdminSettingsPage = lazy(() => import("./pages/admin/AdminSettingsPage"));
const AdminPaymentsPage = lazy(() => import("./pages/admin/AdminPaymentsPage"));
const AdminSubscriptionsPage = lazy(() => import("./pages/admin/AdminSubscriptionsPage"));
const AdminPaymentSettingsPage = lazy(() => import("./pages/admin/AdminPaymentSettingsPage"));
const AdminPlansPage = lazy(() => import("./pages/admin/AdminPlansPage"));
const AdminProductsPage = lazy(() => import("./pages/admin/AdminProductsPage"));
const AdminOrdersPage = lazy(() => import("./pages/admin/AdminOrdersPage"));
const AdminWebhookLogsPage = lazy(() => import("./pages/admin/AdminWebhookLogsPage"));
const AdminContactInboxPage = lazy(() => import("./pages/admin/AdminContactInboxPage"));
const AdminPaymentLogsPage = lazy(() => import("./pages/admin/AdminPaymentLogsPage"));
const AdminStoryEnginePage = lazy(() => import("./pages/admin/AdminStoryEnginePage"));
const AdminAiModelsPage = lazy(() => import("./pages/admin/AdminAiModelsPage"));
const AdminIllustrationAnalyticsPage = lazy(() => import("./pages/admin/AdminIllustrationAnalyticsPage"));
const AdminAiUsagePage = lazy(() => import("./pages/admin/AdminAiUsagePage"));
const AdminAudioPage = lazy(() => import("./pages/admin/AdminAudioPage"));
const AdminAiAgentsPage = lazy(() => import("./pages/admin/AdminAiAgentsPage"));
const AdminAiPromptsPage = lazy(() => import("./pages/admin/AdminAiPromptsPage"));
const AdminAiFeatureTogglesPage = lazy(() => import("./pages/admin/AdminAiFeatureTogglesPage"));
const AdminAiUsageLimitsPage = lazy(() => import("./pages/admin/AdminAiUsageLimitsPage"));
const AdminAiAnalyticsPage = lazy(() => import("./pages/admin/AdminAiAnalyticsPage"));
const AdminPdfTemplatesPage = lazy(() => import("./pages/admin/AdminPdfTemplatesPage"));
const AdminAudioVoicesPage = lazy(() => import("./pages/admin/AdminAudioVoicesPage"));
const AdminRbacPage = lazy(() => import("./pages/admin/AdminRbacPage"));
const AdminAuditLogsPage = lazy(() => import("./pages/admin/AdminAuditLogsPage"));
const AdminDownloadsPage = lazy(() => import("./pages/admin/AdminDownloadsPage"));
const CheckoutManual = lazy(() => import("./pages/CheckoutManual"));
const IllustrateHarness = lazy(() => import("./pages/test/IllustrateHarness"));
const CheckoutOrder = lazy(() => import("./pages/CheckoutOrder"));
const AccountSubscription = lazy(() => import("./pages/AccountSubscription"));
const MyAiStories = lazy(() => import("./pages/MyAiStories"));
const MyAiStoryDetail = lazy(() => import("./pages/MyAiStoryDetail"));
const MyDownloads = lazy(() => import("./pages/MyDownloads"));
const MyBackups = lazy(() => import("./pages/MyBackups"));
const ApiKeys = lazy(() => import("./pages/ApiKeys"));
const AccountProfile = lazy(() => import("./pages/AccountProfile"));
const About = lazy(() => import("./pages/About"));
const Install = lazy(() => import("./pages/Install"));
const Offline = lazy(() => import("./pages/Offline"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // cache 1 min — fewer re-fetches between page navigations
      refetchOnWindowFocus: false,
    },
  },
});

const RouteFallback = () => (
  <div className="flex items-center justify-center py-20">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

const BedtimeWatcher = () => { useBedtimeAutoTheme(); return null; };

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AudioDebugPanel />
        <BrowserRouter>
          <AuthProvider>
            <BedtimeWatcher />
            <AdminDataSourceProvider>
              <Suspense fallback={<RouteFallback />}>
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/admin/auth" element={<AdminAuth />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/" element={<Layout />}>
                    <Route index element={<Index />} />
                    <Route path="stories" element={<StoryLibrary />} />
                    <Route path="stories/:id" element={<StoryDetail />} />
                    <Route path="ai-storyteller" element={<AIStoryteller />} />
                    <Route path="drawing-competition" element={<DrawingCompetition />} />
                    <Route path="blog" element={<Blog />} />
                    <Route path="blog/:slug" element={<BlogPost />} />
                    <Route path="store" element={<Store />} />
                    <Route path="contact" element={<Contact />} />
                    <Route path="pricing" element={<Pricing />} />
                    <Route path="family" element={<Family />} />
                    <Route path="about" element={<About />} />
                    <Route path="install" element={<Install />} />
                    <Route path="offline" element={<Offline />} />
                    <Route path="privacy" element={<Privacy />} />
                    <Route path="terms" element={<Terms />} />
                    <Route element={<ProtectedRoute />}>
                      <Route path="blog/submit" element={<BlogSubmit />} />
                      <Route path="parent" element={<ParentDashboard />} />
                    <Route path="checkout/manual" element={<CheckoutManual />} />
                      <Route path="checkout/order" element={<CheckoutOrder />} />
                      <Route path="account/subscription" element={<AccountSubscription />} />
                      <Route path="my-stories" element={<MyAiStories />} />
                      <Route path="my-stories/:id" element={<MyAiStoryDetail />} />
                      <Route path="my-downloads" element={<MyDownloads />} />
                      <Route path="account/api-keys" element={<ApiKeys />} />
                      <Route path="account/profile" element={<AccountProfile />} />
                    </Route>
                    <Route element={<ProtectedRoute requireAdmin />}>
                      <Route path="admin" element={<Admin />} />
                    </Route>
                  </Route>
                  <Route element={<ProtectedRoute requireStaff />}>
                    <Route path="/admin/dashboard" element={<AdminDashboardLayout />}>
                      <Route index element={<AdminDashboardOverview />} />
                      <Route path="stories" element={<AdminStoriesPage />} />
                      <Route path="story-engine" element={<AdminStoryEnginePage />} />
                      <Route path="ai-models" element={<AdminAiModelsPage />} />
                      <Route path="illustration-analytics" element={<AdminIllustrationAnalyticsPage />} />
                      <Route path="ai-usage" element={<AdminAiUsagePage />} />
                      <Route path="audio" element={<AdminAudioPage />} />
                      <Route path="ai/agents" element={<PermissionGuard permission="manage_agents" sectionLabel="AI Agents"><AdminAiAgentsPage /></PermissionGuard>} />
                      <Route path="ai/prompts" element={<PermissionGuard permission="manage_prompts" sectionLabel="Prompts"><AdminAiPromptsPage /></PermissionGuard>} />
                      <Route path="ai/features" element={<PermissionGuard permission="manage_feature_toggles" sectionLabel="Feature Toggles"><AdminAiFeatureTogglesPage /></PermissionGuard>} />
                      <Route path="ai/limits" element={<PermissionGuard permission="manage_usage_limits" sectionLabel="Usage Limits"><AdminAiUsageLimitsPage /></PermissionGuard>} />
                      <Route path="ai/analytics" element={<PermissionGuard permission="view_analytics" sectionLabel="AI Analytics"><AdminAiAnalyticsPage /></PermissionGuard>} />
                      <Route path="ai/pdf-templates" element={<PermissionGuard permission="manage_pdf_templates" sectionLabel="PDF Templates"><AdminPdfTemplatesPage /></PermissionGuard>} />
                      <Route path="ai/voices" element={<PermissionGuard permission="manage_voices" sectionLabel="Voice Profiles"><AdminAudioVoicesPage /></PermissionGuard>} />
                      <Route path="ai/rbac" element={<PermissionGuard adminOnly sectionLabel="RBAC"><AdminRbacPage /></PermissionGuard>} />
                      <Route path="ai/audit" element={<PermissionGuard permission="view_audit_logs" sectionLabel="Audit Logs"><AdminAuditLogsPage /></PermissionGuard>} />
                      <Route path="downloads" element={<PermissionGuard adminOnly sectionLabel="Downloads"><AdminDownloadsPage /></PermissionGuard>} />
                      <Route path="videos" element={<AdminVideosPage />} />

                      <Route path="blog" element={<AdminBlogPage />} />
                      <Route path="payments" element={<AdminPaymentsPage />} />
                      <Route path="subscriptions" element={<AdminSubscriptionsPage />} />
                      <Route path="payment-settings" element={<AdminPaymentSettingsPage />} />
                      <Route path="plans" element={<AdminPlansPage />} />
                      <Route path="products" element={<AdminProductsPage />} />
                      <Route path="orders" element={<AdminOrdersPage />} />
                      <Route path="webhook-logs" element={<AdminWebhookLogsPage />} />
                      <Route path="payment-logs" element={<AdminPaymentLogsPage />} />
                      <Route path="contact-inbox" element={<AdminContactInboxPage />} />
                      <Route path="languages" element={<AdminLanguagesPage />} />
                      <Route path="settings" element={<AdminSettingsPage />} />
                    </Route>
                  </Route>
                  <Route path="/test/illustrate-harness" element={<IllustrateHarness />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </AdminDataSourceProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
