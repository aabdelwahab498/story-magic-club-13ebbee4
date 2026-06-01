import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  FileCheck2,
  Loader2,
  CheckCircle2,
  XCircle,
  Search,
  Clock,
  ArrowDownAZ,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  approveBlogPost,
  fetchBlogPostsAdminPage,
  fetchBlogStatusCounts,
  rejectBlogPost,
  type BlogPostRecord,
  type BlogSortOrder,
  type BlogSubmissionStatus,
} from "@/lib/blogAdminApi";
import { getLocalized } from "@/lib/multilingual";

const PAGE_SIZE = 8;

interface Counts {
  pending: number;
  approved: number;
  rejected: number;
  all: number;
}

const statusBadge = (s?: string, label?: string) => {
  if (s === "approved")
    return (
      <Badge className="gap-1 rounded-full bg-emerald-500/15 text-emerald-700 border-emerald-300/40 border">
        <CheckCircle2 className="h-3 w-3" /> {label}
      </Badge>
    );
  if (s === "rejected")
    return (
      <Badge className="gap-1 rounded-full bg-destructive/15 text-destructive border-destructive/30 border">
        <XCircle className="h-3 w-3" /> {label}
      </Badge>
    );
  return (
    <Badge className="gap-1 rounded-full bg-amber-500/15 text-amber-700 border-amber-300/40 border">
      <Clock className="h-3 w-3" /> {label}
    </Badge>
  );
};

export default function BlogReviewSection() {
  const { t, i18n } = useTranslation();
  const [status, setStatus] = useState<BlogSubmissionStatus>("pending");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<BlogSortOrder>("newest");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<BlogPostRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [counts, setCounts] = useState<Counts>({
    pending: 0,
    approved: 0,
    rejected: 0,
    all: 0,
  });
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<BlogPostRecord | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Debounce search
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(id);
  }, [search]);

  const loadCounts = useCallback(() => {
    fetchBlogStatusCounts()
      .then(setCounts)
      .catch((e) => console.error(e));
  }, []);

  const loadPage = useCallback(
    async (nextPage: number, replace: boolean) => {
      if (replace) setLoading(true);
      else setLoadingMore(true);
      try {
        const res = await fetchBlogPostsAdminPage({
          status,
          search: debouncedSearch,
          sort,
          page: nextPage,
          pageSize: PAGE_SIZE,
        });
        setTotal(res.total);
        setRows((prev) => {
          if (replace) return res.rows;
          const seen = new Set(prev.map((r) => r.id));
          return [...prev, ...res.rows.filter((r) => !seen.has(r.id))];
        });
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message ?? "Failed to load");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [status, debouncedSearch, sort]
  );

  // Reset & reload when filters change
  useEffect(() => {
    setPage(0);
    loadPage(0, true);
  }, [status, debouncedSearch, sort, loadPage]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const handleApprove = async (p: BlogPostRecord) => {
    setActingId(p.id);
    try {
      await approveBlogPost(p.id);
      toast.success(t("admin_dashboard.blog_review.approved", "Post approved & published"));
      setRows((prev) => prev.filter((x) => x.id !== p.id));
      setTotal((n) => Math.max(0, n - 1));
      loadCounts();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setActingId(null);
    }
  };

  const openReject = (p: BlogPostRecord) => {
    setRejectTarget(p);
    setRejectReason("");
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      toast.error(t("admin_dashboard.blog_review.reason_required", "Please provide a reason"));
      return;
    }
    const id = rejectTarget.id;
    setActingId(id);
    try {
      await rejectBlogPost(id, rejectReason.trim());
      toast.success(t("admin_dashboard.blog_review.rejected", "Post rejected"));
      setRows((prev) => prev.filter((x) => x.id !== id));
      setTotal((n) => Math.max(0, n - 1));
      setRejectTarget(null);
      setRejectReason("");
      loadCounts();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed");
    } finally {
      setActingId(null);
    }
  };

  const filterTabs = useMemo(
    () =>
      [
        { key: "pending", label: t("admin_dashboard.blog_review.tab_pending", "Pending"), count: counts.pending },
        { key: "approved", label: t("admin_dashboard.blog_review.tab_approved", "Approved"), count: counts.approved },
        { key: "rejected", label: t("admin_dashboard.blog_review.tab_rejected", "Rejected"), count: counts.rejected },
        { key: "all", label: t("admin_dashboard.blog_review.tab_all", "All"), count: counts.all },
      ] as const,
    [counts, t]
  );

  const canLoadMore = rows.length < total;

  return (
    <Card className="border-2 border-kids-softPurple/40 dark:border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <CardTitle className="flex items-center gap-2">
          <FileCheck2 className="h-5 w-5 text-primary" />
          {t("admin_dashboard.blog_review.title", "Blog posts review")}
        </CardTitle>
        <Link to="/admin/dashboard/blog">
          <Button variant="outline" size="sm">
            {t("admin_dashboard.blog_review.open_blog", "Open blog manager")}
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filter tabs with counters */}
        <div className="flex flex-wrap gap-2">
          {filterTabs.map((tab) => {
            const active = status === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setStatus(tab.key as BlogSubmissionStatus)}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium border transition-all ${
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-soft"
                    : "bg-background hover:bg-muted/50 border-border text-foreground"
                }`}
              >
                {tab.label}
                <Badge
                  variant="secondary"
                  className={`rounded-full px-2 py-0 text-xs ${
                    active ? "bg-primary-foreground/20 text-primary-foreground" : ""
                  }`}
                >
                  {tab.count}
                </Badge>
              </button>
            );
          })}
        </div>

        {/* Search + sort */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 rtl:left-auto rtl:right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t(
                "admin_dashboard.blog_review.search_placeholder",
                "Search by title or author…"
              )}
              className="pl-9 rtl:pl-3 rtl:pr-9"
            />
          </div>
          <Select value={sort} onValueChange={(v) => setSort(v as BlogSortOrder)}>
            <SelectTrigger className="w-full sm:w-44">
              <ArrowDownAZ className="h-4 w-4 mr-2 rtl:mr-0 rtl:ml-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">
                {t("admin_dashboard.blog_review.sort_newest", "Newest first")}
              </SelectItem>
              <SelectItem value="oldest">
                {t("admin_dashboard.blog_review.sort_oldest", "Oldest first")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-center text-muted-foreground py-8 text-sm">
            {t("admin_dashboard.blog_review.empty", "No posts match the current filters.")}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((p) => (
              <li
                key={p.id}
                className="py-3 flex items-start justify-between gap-3 flex-wrap"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate">
                      {getLocalized(p.title, i18n.language) || p.slug}
                    </p>
                    {statusBadge(
                      p.submission_status,
                      t(
                        `admin_dashboard.blog_review.tab_${p.submission_status ?? "pending"}`,
                        p.submission_status ?? "pending"
                      )
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {p.author_name ?? "—"} ·{" "}
                    {new Date(p.created_at).toLocaleDateString(i18n.language)}
                  </p>
                  {p.review_note && p.submission_status === "rejected" && (
                    <p className="text-xs text-destructive truncate">
                      {t("admin_dashboard.blog_review.reason", "Reason")}: {p.review_note}
                    </p>
                  )}
                </div>
                {p.submission_status !== "approved" && (
                  <div className="flex items-center gap-2 shrink-0">
                    {p.submission_status !== "rejected" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openReject(p)}
                        disabled={actingId === p.id}
                        className="gap-1"
                      >
                        <XCircle className="h-4 w-4" />
                        {t("admin_dashboard.blog_review.reject", "Reject")}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => handleApprove(p)}
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
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Pagination / load more */}
        {!loading && rows.length > 0 && (
          <div className="flex items-center justify-between gap-2 pt-2">
            <p className="text-xs text-muted-foreground">
              {t("admin_dashboard.blog_review.showing", "Showing {{count}} of {{total}}", {
                count: rows.length,
                total,
              })}
            </p>
            {canLoadMore && (
              <Button
                variant="outline"
                size="sm"
                disabled={loadingMore}
                onClick={() => {
                  const next = page + 1;
                  setPage(next);
                  loadPage(next, false);
                }}
                className="gap-2"
              >
                {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("admin_dashboard.blog_review.load_more", "Load more")}
              </Button>
            )}
          </div>
        )}
      </CardContent>

      {/* Reject reason dialog */}
      <Dialog
        open={!!rejectTarget}
        onOpenChange={(o) => {
          if (!o) {
            setRejectTarget(null);
            setRejectReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("admin_dashboard.blog_review.reject_title", "Reject blog post")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "admin_dashboard.blog_review.reject_desc",
                "Tell the author why this post is being rejected. They will see this note."
              )}
            </DialogDescription>
          </DialogHeader>
          {rejectTarget && (
            <div className="space-y-3">
              <p className="text-sm font-medium truncate">
                {getLocalized(rejectTarget.title, i18n.language) || rejectTarget.slug}
              </p>
              <div className="space-y-2">
                <Label>
                  {t("admin_dashboard.blog_review.reason_label", "Rejection reason")} *
                </Label>
                <Textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  placeholder={t(
                    "admin_dashboard.blog_review.reason_placeholder",
                    "Explain what needs to change…"
                  )}
                />
                <p className="text-xs text-muted-foreground">{rejectReason.length}/1000</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectTarget(null);
                setRejectReason("");
              }}
              disabled={actingId === rejectTarget?.id}
            >
              {t("admin_dashboard.blog_review.cancel", "Cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={actingId === rejectTarget?.id || !rejectReason.trim()}
              className="gap-2"
            >
              {actingId === rejectTarget?.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="h-4 w-4" />
              )}
              {t("admin_dashboard.blog_review.confirm_reject", "Reject post")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
