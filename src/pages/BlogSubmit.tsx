import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, CheckCircle2, Clock, XCircle, Send } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import FileUploadField from "@/components/admin/FileUploadField";
import {
  fetchBlogCategories,
  fetchMyBlogSubmissions,
  submitBlogPost,
  uploadBlogCover,
  slugify,
  type BlogCategoryRecord,
  type BlogPostRecord,
} from "@/lib/blogAdminApi";
import { getLocalized } from "@/lib/multilingual";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const BlogSubmit = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string>("none");
  const [authorName, setAuthorName] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [categories, setCategories] = useState<BlogCategoryRecord[]>([]);
  const [mySubmissions, setMySubmissions] = useState<BlogPostRecord[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  const lang = i18n.language ?? "en";

  useEffect(() => {
    if (!user) return;
    setLoadingList(true);
    Promise.all([fetchBlogCategories(), fetchMyBlogSubmissions()])
      .then(([cats, mine]) => {
        setCategories(cats);
        setMySubmissions(mine);
      })
      .catch((e) => {
        console.error(e);
        toast.error(t("blog_submit.load_failed", "Failed to load"));
      })
      .finally(() => setLoadingList(false));
  }, [user, t]);

  const computedSlug = useMemo(() => slug.trim() || slugify(title), [slug, title]);

  if (authLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center">
        <p className="text-muted-foreground mb-4">
          {t("blog_submit.sign_in_required", "Please sign in to submit a blog post.")}
        </p>
        <Link to="/auth">
          <Button>{t("nav.sign_in", "Sign in")}</Button>
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error(t("blog_submit.title_required", "Title is required"));
      return;
    }
    if (!content.trim() || content.trim().length < 50) {
      toast.error(t("blog_submit.content_too_short", "Content must be at least 50 characters"));
      return;
    }
    const finalSlug = computedSlug;
    if (!finalSlug) {
      toast.error(t("blog_submit.slug_required", "Slug required"));
      return;
    }
    setSubmitting(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const localizedField = (text: string): Record<string, string> => ({ [lang]: text, en: text });
      const saved = await submitBlogPost({
        slug: finalSlug,
        category_id: categoryId === "none" ? null : categoryId,
        title: localizedField(title.trim()),
        excerpt: localizedField(excerpt.trim()),
        content: localizedField(content.trim()),
        cover_image: coverImage,
        author_name: authorName.trim() || null,
        tags,
      });
      toast.success(
        t("blog_submit.submitted_for_review", "Submitted! Your post is pending admin review.")
      );
      setTitle("");
      setSlug("");
      setExcerpt("");
      setContent("");
      setCoverImage(null);
      setCategoryId("none");
      setAuthorName("");
      setTagsInput("");
      setMySubmissions((prev) => [saved, ...prev]);
    } catch (err) {
      console.error(err);
      const e = err as { message?: string } | null;
      toast.error(e?.message ?? t("blog_submit.submit_failed", "Submission failed"));
    } finally {
      setSubmitting(false);
    }
  };

  const renderStatusBadge = (s?: string) => {
    if (s === "approved")
      return (
        <Badge className="gap-1 rounded-full bg-emerald-500/15 text-emerald-700 border-emerald-300/40 border">
          <CheckCircle2 className="h-3 w-3" />
          {t("blog_submit.status.approved", "Approved")}
        </Badge>
      );
    if (s === "rejected")
      return (
        <Badge className="gap-1 rounded-full bg-destructive/15 text-destructive border-destructive/30 border">
          <XCircle className="h-3 w-3" />
          {t("blog_submit.status.rejected", "Rejected")}
        </Badge>
      );
    return (
      <Badge className="gap-1 rounded-full bg-amber-500/15 text-amber-700 border-amber-300/40 border">
        <Clock className="h-3 w-3" />
        {t("blog_submit.status.pending", "Pending review")}
      </Badge>
    );
  };

  return (
    <div className="py-4 sm:py-6 max-w-3xl mx-auto">
      <Link
        to="/blog"
        className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:gap-3 transition-all mb-4"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        {t("blog.back_to_list", "Back to blog")}
      </Link>

      <header className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground mb-2">
          {t("blog_submit.title_page", "Submit a blog post")}
        </h1>
        <p className="text-muted-foreground">
          {t(
            "blog_submit.subtitle",
            "Share your story with our community. Posts are reviewed by our team before being published."
          )}
        </p>
      </header>

      <Card className="border-2 border-white/60 bg-white/95 dark:bg-card/90 shadow-soft">
        <CardContent className="p-5 sm:p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("blog_submit.title_label", "Title")} *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={150}
                placeholder={t("blog_submit.title_placeholder", "Your post title")}
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder={computedSlug || "auto-generated"}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("admin_blog.category", "Category")}</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("admin_blog.none", "None")}</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {getLocalized(c.name, lang) || c.slug}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("admin_blog.excerpt", "Excerpt")}</Label>
              <Textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                maxLength={300}
                rows={2}
                placeholder={t("blog_submit.excerpt_placeholder", "Short summary (1-2 sentences)")}
              />
            </div>

            <div className="space-y-2">
              <Label>{t("blog_submit.content_label", "Content (Markdown)")} *</Label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                maxLength={20000}
                rows={12}
                placeholder={t("blog_submit.content_placeholder", "Write your post here…")}
                required
              />
              <p className="text-xs text-muted-foreground">
                {content.length} / 20000
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("admin_blog.author", "Author")}</Label>
                <Input
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  maxLength={100}
                  placeholder={user.email ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("admin_blog.tags", "Tags")}</Label>
                <Input
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder={t("blog_submit.tags_placeholder", "comma, separated, tags")}
                />
              </div>
            </div>

            <FileUploadField
              label={t("admin_blog.cover_image", "Cover image")}
              value={coverImage}
              onChange={(url) => setCoverImage(url)}
              uploader={uploadBlogCover}
              accept="image/*"
              preview="image"
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/blog")}
                disabled={submitting}
              >
                {t("admin_blog.cancel", "Cancel")}
              </Button>
              <Button type="submit" disabled={submitting} className="gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {t("blog_submit.submit", "Submit for review")}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <section className="mt-8">
        <Card className="border-2 border-white/60 bg-white/95 dark:bg-card/90 shadow-soft">
          <CardHeader>
            <CardTitle className="text-lg">
              {t("blog_submit.my_submissions", "My submissions")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingList ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : mySubmissions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                {t("blog_submit.no_submissions", "You haven't submitted any posts yet.")}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {mySubmissions.map((p) => (
                  <li key={p.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">
                        {getLocalized(p.title, lang) || p.slug}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString(lang)}
                        {p.review_note ? ` — ${p.review_note}` : ""}
                      </p>
                    </div>
                    <div className="shrink-0">{renderStatusBadge(p.submission_status)}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
};

export default BlogSubmit;
