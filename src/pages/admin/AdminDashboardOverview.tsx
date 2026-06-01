import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Video, Languages, Eye, TrendingUp, Sparkles, Loader2 } from "lucide-react";
import { MOCK_STATS, MOCK_STORIES } from "@/lib/adminMockData";
import { fetchStories, fetchVideos, type StoryRecord } from "@/lib/adminApi";
import { useAdminDataSource } from "@/hooks/useAdminDataSource";
import { getLocalized } from "@/lib/multilingual";
import { ADMIN_LANGUAGES } from "@/lib/adminConstants";
import { toast } from "sonner";
import BlogReviewSection from "@/components/admin/BlogReviewSection";

interface DashboardStats {
  totalStories: number;
  publishedStories: number;
  totalVideos: number;
  publishedVideos: number;
  activeLanguages: number;
  totalViews: number;
}

export default function AdminDashboardOverview() {
  const { t, i18n } = useTranslation();
  const { isMock } = useAdminDataSource();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalStories: MOCK_STATS.totalStories,
    publishedStories: MOCK_STATS.publishedStories,
    totalVideos: MOCK_STATS.totalVideos,
    publishedVideos: MOCK_STATS.publishedVideos,
    activeLanguages: MOCK_STATS.activeLanguages,
    totalViews: MOCK_STATS.totalViews,
  });
  const [topStories, setTopStories] = useState<
    Array<{ id: string; title: Record<string, string>; category: string | null; age_range: string | null; views: number }>
  >(
    [...MOCK_STORIES]
      .sort((a, b) => b.views - a.views)
      .slice(0, 5)
      .map((s) => ({ id: s.id, title: s.title, category: s.category, age_range: s.age_range, views: s.views }))
  );


  useEffect(() => {
    if (isMock) {
      setStats({
        totalStories: MOCK_STATS.totalStories,
        publishedStories: MOCK_STATS.publishedStories,
        totalVideos: MOCK_STATS.totalVideos,
        publishedVideos: MOCK_STATS.publishedVideos,
        activeLanguages: MOCK_STATS.activeLanguages,
        totalViews: MOCK_STATS.totalViews,
      });
      setTopStories(
        [...MOCK_STORIES]
          .sort((a, b) => b.views - a.views)
          .slice(0, 5)
          .map((s) => ({ id: s.id, title: s.title, category: s.category, age_range: s.age_range, views: s.views }))
      );
      return;
    }
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchStories(), fetchVideos()])
      .then(([stories, videos]) => {
        if (cancelled) return;
        const totalViews =
          stories.reduce((acc, s) => acc + (s.views ?? 0), 0) +
          videos.reduce((acc, v) => acc + (v.views ?? 0), 0);
        setStats({
          totalStories: stories.length,
          publishedStories: stories.filter((s) => s.published).length,
          totalVideos: videos.length,
          publishedVideos: videos.filter((v) => v.published).length,
          activeLanguages: ADMIN_LANGUAGES.length,
          totalViews,
        });
        setTopStories(
          [...stories]
            .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
            .slice(0, 5)
            .map((s: StoryRecord) => ({
              id: s.id,
              title: s.title as Record<string, string>,
              category: s.category,
              age_range: s.age_range,
              views: s.views ?? 0,
            }))
        );
      })
      .catch((err) => {
        console.error(err);
        toast.error(t("admin_dashboard.toast.load_failed"));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [isMock, t]);

  const statCards = [
    {
      label: t("admin_dashboard.stats.total_stories"),
      value: stats.totalStories,
      sub: t("admin_dashboard.stats.published_count", { count: stats.publishedStories }),
      icon: BookOpen,
      gradient: "from-kids-purple to-kids-pink",
    },
    {
      label: t("admin_dashboard.stats.total_videos"),
      value: stats.totalVideos,
      sub: t("admin_dashboard.stats.published_count", { count: stats.publishedVideos }),
      icon: Video,
      gradient: "from-kids-blue to-accent",
    },
    {
      label: t("admin_dashboard.stats.active_languages"),
      value: stats.activeLanguages,
      sub: t("admin_dashboard.stats.languages_sub"),
      icon: Languages,
      gradient: "from-kids-green to-kids-blue",
    },
    {
      label: t("admin_dashboard.stats.total_views"),
      value: stats.totalViews.toLocaleString(),
      sub: t("admin_dashboard.stats.views_sub"),
      icon: Eye,
      gradient: "from-kids-orange to-kids-yellow",
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-2 bg-magic bg-clip-text text-transparent">
            <Sparkles className="h-8 w-8 text-primary animate-twinkle" />
            {t("admin_dashboard.overview.title")}
          </h1>
          <p className="text-muted-foreground mt-1 text-base">
            {t("admin_dashboard.overview.subtitle")}
          </p>
        </div>
        <Badge variant="secondary" className="gap-1.5 rounded-full px-3 py-1">
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <span className={`h-2 w-2 rounded-full animate-pulse ${isMock ? "bg-amber-500" : "bg-green-500"}`} />
          )}
          {isMock ? t("admin_dashboard.overview.using_mock") : "Live data"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((s, i) => (
          <Card
            key={s.label}
            className="overflow-hidden border-2 border-kids-softPurple/40 dark:border-primary/20 hover:shadow-glow transition-all duration-300 animate-fade-in"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className={`h-2 bg-gradient-to-r ${s.gradient}`} />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold text-muted-foreground">
                {s.label}
              </CardTitle>
              <div className={`h-10 w-10 rounded-2xl bg-gradient-to-br ${s.gradient} flex items-center justify-center shadow-soft`}>
                <s.icon className="h-5 w-5 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl md:text-4xl font-bold">{s.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-2 border-kids-softPurple/40 dark:border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            {t("admin_dashboard.overview.most_viewed")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {topStories.length === 0 ? (
              <p className="text-center text-muted-foreground py-6">
                {t("admin_dashboard.empty")}
              </p>
            ) : (
              topStories.map((story, i) => (
                <div
                  key={story.id}
                  className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-kids-softPurple/30 dark:hover:bg-primary/10 transition-all hover:translate-x-1"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-magic text-primary-foreground font-bold text-sm shadow-soft">
                      {i + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold truncate">
                        {getLocalized(story.title, i18n.language) || "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {story.category
                          ? t(`admin_dashboard.categories.${story.category}`, story.category)
                          : "—"}{" "}
                        • {story.age_range ?? "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
                    <Eye className="h-4 w-4" />
                    {story.views.toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-kids-softPurple/40 dark:border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <FileCheck2 className="h-5 w-5 text-primary" />
            {t("admin_dashboard.blog_review.title", "Blog posts awaiting review")}
            {pendingPosts.length > 0 && (
              <Badge variant="secondary" className="ml-1 rounded-full">
                {pendingPosts.length}
              </Badge>
            )}
          </CardTitle>
          <Link to="/admin/dashboard/blog">
            <Button variant="outline" size="sm">
              {t("admin_dashboard.blog_review.open_blog", "Open blog manager")}
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {pendingLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : pendingPosts.length === 0 ? (
            <p className="text-center text-muted-foreground py-6 text-sm">
              {t("admin_dashboard.blog_review.empty", "No pending submissions right now.")}
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {pendingPosts.slice(0, 8).map((p) => (
                <li key={p.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">
                      {getLocalized(p.title, i18n.language) || p.slug}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {p.author_name ?? "—"} • {new Date(p.created_at).toLocaleDateString(i18n.language)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(p.id)}
                      disabled={actingId === p.id}
                      className="gap-1"
                    >
                      <XCircle className="h-4 w-4" />
                      {t("admin_dashboard.blog_review.reject", "Reject")}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleApprove(p.id)}
                      disabled={actingId === p.id}
                      className="gap-1"
                    >
                      {actingId === p.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {t("admin_dashboard.blog_review.approve", "Approve")}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
