import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOutletContext } from "react-router-dom";
import {
  Plus,
  Pencil,
  Trash2,
  Search,
  CheckCircle2,
  Circle,
  Loader2,
  X,
  Check,
  XCircle,
  Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import MultilingualField from "@/components/admin/MultilingualField";
import FileUploadField from "@/components/admin/FileUploadField";
import { getLocalized } from "@/lib/multilingual";
import {
  fetchBlogPostsAdmin,
  fetchBlogCategories,
  upsertBlogPost,
  deleteBlogPost,
  uploadBlogCover,
  slugify,
  approveBlogPost,
  rejectBlogPost,
  type BlogPostRecord,
  type BlogCategoryRecord,
} from "@/lib/blogAdminApi";

const emptyPost = (): BlogPostRecord => ({
  id: `new-${Date.now()}`,
  slug: "",
  category_id: null,
  title: {},
  excerpt: {},
  content: {},
  seo_title: {},
  seo_description: {},
  cover_image: null,
  author_name: null,
  reading_minutes: 3,
  tags: [],
  published: false,
  published_at: null,
  views: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

export default function AdminBlogPage() {
  const { t, i18n } = useTranslation();
  const { isAdmin } = useOutletContext<{ isAdmin: boolean; isEditor: boolean }>();
  const [posts, setPosts] = useState<BlogPostRecord[]>([]);
  const [categories, setCategories] = useState<BlogCategoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [editing, setEditing] = useState<BlogPostRecord | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const isAr = i18n.language?.startsWith("ar");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchBlogPostsAdmin(), fetchBlogCategories()])
      .then(([p, c]) => {
        if (cancelled) return;
        setPosts(p);
        setCategories(c);
      })
      .catch((err) => {
        console.error(err);
        toast.error(t("admin_blog.failed_to_load", "Failed to load"));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [isAr]);

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      const title = getLocalized(p.title, i18n.language).toLowerCase();
      const slug = (p.slug ?? "").toLowerCase();
      if (search && !title.includes(search.toLowerCase()) && !slug.includes(search.toLowerCase())) return false;
      if (statusFilter === "published" && !p.published) return false;
      if (statusFilter === "draft" && p.published) return false;
      return true;
    });
  }, [posts, search, statusFilter, i18n.language]);

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.title.en?.trim()) {
      toast.error(t("admin_blog.english_title_required", "English title required"));
      return;
    }
    let slug = editing.slug?.trim();
    if (!slug) slug = slugify(editing.title.en);
    if (!slug) {
      toast.error(t("admin_blog.slug_required", "Slug required"));
      return;
    }
    setSaving(true);
    try {
      const saved = await upsertBlogPost({ ...editing, slug });
      setPosts((prev) => {
        const exists = prev.find((p) => p.id === editing.id);
        if (exists) return prev.map((p) => (p.id === editing.id ? saved : p));
        return [saved, ...prev];
      });
      toast.success(t("admin_blog.saved", "Saved"));
      setEditing(null);
      setTagInput("");
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message ?? (t("admin_blog.save_failed", "Save failed")));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteBlogPost(deleteId);
      setPosts((prev) => prev.filter((p) => p.id !== deleteId));
      toast.success(t("admin_blog.deleted", "Deleted"));
    } catch (err) {
      console.error(err);
      toast.error(t("admin_blog.delete_failed", "Delete failed"));
    } finally {
      setDeleteId(null);
    }
  };

  const addTag = () => {
    if (!editing) return;
    const v = tagInput.trim();
    if (!v) return;
    if ((editing.tags ?? []).includes(v)) return;
    setEditing({ ...editing, tags: [...(editing.tags ?? []), v] });
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    if (!editing) return;
    setEditing({ ...editing, tags: (editing.tags ?? []).filter((t) => t !== tag) });
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold bg-magic bg-clip-text text-transparent">
            {t("admin_blog.blog", "Blog")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("admin_blog.manage_posts_tags_seo", "Manage posts, tags & SEO")}
          </p>
        </div>
        <Button onClick={() => setEditing(emptyPost())} className="gap-2 rounded-full shadow-soft hover-pop">
          <Plus className="h-4 w-4" />
          {t("admin_blog.new_post", "New post")}
        </Button>
      </div>

      <Card className="border-2 border-kids-softPurple/40 dark:border-primary/20">
        <CardContent className="p-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("admin_blog.search_title_or_slug", "Search title or slug")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-full"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as never)}>
            <SelectTrigger className="w-[160px] rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin_blog.all_status", "All status")}</SelectItem>
              <SelectItem value="published">{t("admin_blog.published", "Published")}</SelectItem>
              <SelectItem value="draft">{t("admin_blog.draft", "Draft")}</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="border-2 border-kids-softPurple/40 dark:border-primary/20">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("admin_blog.title", "Title")}</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>{t("admin_blog.tags", "Tags")}</TableHead>
                  <TableHead>{t("admin_blog.langs", "Langs")}</TableHead>
                  <TableHead>{t("admin_blog.status", "Status")}</TableHead>
                  <TableHead>{t("admin_blog.views", "Views")}</TableHead>
                  <TableHead className="text-right">{t("admin_blog.actions", "Actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {t("admin_blog.no_posts", "No posts")}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p) => {
                    const langCount = Object.values(p.title).filter((v) => !!v?.trim()).length;
                    return (
                      <TableRow key={p.id} className="hover:bg-kids-softPurple/20 dark:hover:bg-primary/5">
                        <TableCell className="font-medium">
                          {getLocalized(p.title, i18n.language) || "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {p.slug}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {(p.tags ?? []).slice(0, 3).map((tag) => (
                              <Badge key={tag} variant="outline" className="rounded-full text-xs">
                                {tag}
                              </Badge>
                            ))}
                            {(p.tags?.length ?? 0) > 3 && (
                              <Badge variant="outline" className="rounded-full text-xs">
                                +{(p.tags?.length ?? 0) - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="rounded-full">
                            {langCount} / 6
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {p.published ? (
                            <Badge className="gap-1 rounded-full bg-magic border-0">
                              <CheckCircle2 className="h-3 w-3" />
                              {t("admin_blog.published", "Published")}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 rounded-full">
                              <Circle className="h-3 w-3" />
                              {t("admin_blog.draft", "Draft")}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{(p.views ?? 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditing(p)}
                              className="rounded-full"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteId(p.id)}
                                className="rounded-full text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && (setEditing(null), setTagInput(""))}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing?.id.startsWith("new-")
                ? (t("admin_blog.new_post", "New post"))
                : (t("admin_blog.edit_post", "Edit post"))}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-5">
              <MultilingualField
                label={t("admin_blog.title", "Title")}
                value={editing.title}
                onChange={(v) => setEditing({ ...editing, title: v })}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <div className="flex gap-2">
                    <Input
                      value={editing.slug}
                      onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                      placeholder="my-post-slug"
                      className="font-mono"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setEditing({ ...editing, slug: slugify(editing.title.en ?? "") })
                      }
                    >
                      {t("admin_blog.auto", "Auto")}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t("admin_blog.category", "Category")}</Label>
                  <Select
                    value={editing.category_id ?? "none"}
                    onValueChange={(v) =>
                      setEditing({ ...editing, category_id: v === "none" ? null : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("admin_blog.none", "None")}</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {getLocalized(c.name, i18n.language) || c.slug}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <MultilingualField
                label={t("admin_blog.excerpt", "Excerpt")}
                value={editing.excerpt}
                onChange={(v) => setEditing({ ...editing, excerpt: v })}
                multiline
                rows={2}
              />
              <MultilingualField
                label={t("admin_blog.content_markdown", "Content (Markdown)")}
                value={editing.content}
                onChange={(v) => setEditing({ ...editing, content: v })}
                multiline
                rows={10}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>{t("admin_blog.author", "Author")}</Label>
                  <Input
                    value={editing.author_name ?? ""}
                    onChange={(e) => setEditing({ ...editing, author_name: e.target.value || null })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("admin_blog.reading_minutes", "Reading minutes")}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={editing.reading_minutes ?? 3}
                    onChange={(e) =>
                      setEditing({ ...editing, reading_minutes: Number(e.target.value) || 1 })
                    }
                  />
                </div>
              </div>

              <FileUploadField
                label={t("admin_blog.cover_image", "Cover image")}
                value={editing.cover_image}
                onChange={(url) => setEditing({ ...editing, cover_image: url })}
                uploader={uploadBlogCover}
                accept="image/*"
                preview="image"
              />

              {/* Tags */}
              <div className="space-y-2">
                <Label>{t("admin_blog.tags_keywords", "Tags / Keywords")}</Label>
                <div className="flex gap-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    placeholder={t("admin_blog.add_tag_and_press_enter", "Add tag and press Enter")}
                  />
                  <Button type="button" variant="outline" onClick={addTag}>
                    {t("admin_blog.add", "Add")}
                  </Button>
                </div>
                {(editing.tags ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {(editing.tags ?? []).map((tag) => (
                      <Badge key={tag} variant="secondary" className="rounded-full gap-1 pr-1">
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="rounded-full hover:bg-destructive/20 p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* SEO */}
              <div className="space-y-3 rounded-xl border-2 border-kids-softPurple/30 dark:border-primary/20 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">SEO</h3>
                  <Badge variant="outline" className="rounded-full text-xs">
                    {t("admin_blog.optional", "Optional")}
                  </Badge>
                </div>
                <MultilingualField
                  label={t("admin_blog.seo_title_60_chars", "SEO Title (≤60 chars)")}
                  value={editing.seo_title}
                  onChange={(v) => setEditing({ ...editing, seo_title: v })}
                  placeholder={t("admin_blog.defaults_to_post_title", "Defaults to post title")}
                />
                <MultilingualField
                  label={t("admin_blog.seo_description_160_chars", "SEO Description (≤160 chars)")}
                  value={editing.seo_description}
                  onChange={(v) => setEditing({ ...editing, seo_description: v })}
                  multiline
                  rows={2}
                  placeholder={t("admin_blog.defaults_to_excerpt", "Defaults to excerpt")}
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border-2 border-kids-softPurple/30 dark:border-primary/20 p-3">
                <div>
                  <Label className="font-semibold">{t("admin_blog.published_2", "Published")}</Label>
                  <p className="text-xs text-muted-foreground">
                    {t("admin_blog.visible_to_readers", "Visible to readers")}
                  </p>
                </div>
                <Switch
                  checked={editing.published}
                  onCheckedChange={(v) => setEditing({ ...editing, published: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              {t("admin_blog.cancel", "Cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("admin_blog.save", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin_blog.delete_post", "Delete post?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin_blog.this_action_cannot_be_undone", "This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin_blog.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("admin_blog.delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
