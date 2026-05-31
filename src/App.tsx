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

// Lazy-load every non-home route so the initial bundle stays small.
// This is the single biggest win for first-paint performance.
const StoryLibrary = lazy(() => import("./pages/StoryLibrary"));
const StoryDetail = lazy(() => import("./pages/StoryDetail"));
const AIStoryteller = lazy(() => import("./pages/AIStoryteller"));
const DrawingCompetition = lazy(() => import("./pages/DrawingCompetition"));
const Auth = lazy(() => import("./pages/Auth"));
const Admin = lazy(() => import("./pages/Admin"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
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
const AdminPaymentSettingsPage = lazy(() => import("./pages/admin/AdminPaymentSettingsPage"));
const AdminPlansPage = lazy(() => import("./pages/admin/AdminPlansPage"));
const AdminProductsPage = lazy(() => import("./pages/admin/AdminProductsPage"));
const AdminStoryEnginePage = lazy(() => import("./pages/admin/AdminStoryEnginePage"));
const AdminAiModelsPage = lazy(() => import("./pages/admin/AdminAiModelsPage"));
const AdminIllustrationAnalyticsPage = lazy(() => import("./pages/admin/AdminIllustrationAnalyticsPage"));
const AdminAiUsagePage = lazy(() => import("./pages/admin/AdminAiUsagePage"));
const CheckoutManual = lazy(() => import("./pages/CheckoutManual"));
const IllustrateHarness = lazy(() => import("./pages/test/IllustrateHarness"));
const CheckoutOrder = lazy(() => import("./pages/CheckoutOrder"));
const AccountSubscription = lazy(() => import("./pages/AccountSubscription"));
const MyAiStories = lazy(() => import("./pages/MyAiStories"));
const ApiKeys = lazy(() => import("./pages/ApiKeys"));
const AccountProfile = lazy(() => import("./pages/AccountProfile"));
const About = lazy(() => import("./pages/About"));
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
                    <Route path="privacy" element={<Privacy />} />
                    <Route path="terms" element={<Terms />} />
                    <Route element={<ProtectedRoute />}>
                      <Route path="parent" element={<ParentDashboard />} />
                    <Route path="checkout/manual" element={<CheckoutManual />} />
                      <Route path="checkout/order" element={<CheckoutOrder />} />
                      <Route path="account/subscription" element={<AccountSubscription />} />
                      <Route path="my-stories" element={<MyAiStories />} />
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
                      <Route path="videos" element={<AdminVideosPage />} />
                      <Route path="blog" element={<AdminBlogPage />} />
                      <Route path="payments" element={<AdminPaymentsPage />} />
                      <Route path="payment-settings" element={<AdminPaymentSettingsPage />} />
                      <Route path="plans" element={<AdminPlansPage />} />
                      <Route path="products" element={<AdminProductsPage />} />
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
