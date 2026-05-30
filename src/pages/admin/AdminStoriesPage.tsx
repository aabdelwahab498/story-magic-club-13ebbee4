import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useOutletContext } from "react-router-dom";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  Search,
  CheckCircle2,
  Circle,
  Loader2,
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
import { MOCK_STORIES, type MockStory } from "@/lib/adminMockData";
import { STORY_CATEGORIES, AGE_RANGES } from "@/lib/adminConstants";
import { getLocalized, type Multilingual } from "@/lib/multilingual";
import { useAdminDataSource } from "@/hooks/useAdminDataSource";
import {
  fetchStories,
  upsertStory,
  deleteStory,
  uploadStoryImage,
  uploadStoryAudio,
  uploadStoryPdf,
  type StoryRecord,
} from "@/lib/adminApi";

type StoryItem = MockStory | StoryRecord;

const emptyStory = (): MockStory => ({
  id: `new-${Date.now()}`,
  title: {},
  description: {},
  content: {},
  age_range: "3-5",
  category: "bedtime",
  image: null,
  audio_url: null,
  duration: "",
  published: false,
  views: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

export default function AdminStoriesPage() {
  const { t, i18n } = useTranslation();
  const { isAdmin } = useOutletContext<{ isAdmin: boolean; isEditor: boolean }>();
  const { isMock } = useAdminDataSource();
  const [stories, setStories] = useState<StoryItem[]>(MOCK_STORIES);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [editing, setEditing] = useState<StoryItem | null>(null);
  const [previewing, setPreviewing] = useState<StoryItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Load when source changes
  useEffect(() => {
    if (isMock) {
      setStories(MOCK_STORIES);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchStories()
      .then((data) => {
        if (!cancelled) setStories(data);
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

  const filtered = useMemo(() => {
    return stories.filter((s) => {
      const title = getLocalized(s.title, i18n.language).toLowerCase();
      if (search && !title.includes(search.toLowerCase())) return false;
      if (statusFilter === "published" && !s.published) return false;
      if (statusFilter === "draft" && s.published) return false;
      if (categoryFilter !== "all" && s.category !== categoryFilter) return false;
      return true;
    });
  }, [stories, search, statusFilter, categoryFilter, i18n.language]);

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.title.en?.trim()) {
      toast.error(t("admin_dashboard.errors.english_required"));
      return;
    }
    if (isMock) {
      setStories((prev) => {
        const exists = prev.find((s) => s.id === editing.id);
        if (exists) return prev.map((s) => (s.id === editing.id ? editing : s));
        return [editing, ...prev];
      });
      toast.success(t("admin_dashboard.toast.saved"));
      setEditing(null);
      return;
    }
    setSaving(true);
    try {
      const saved = await upsertStory(editing as Partial<StoryRecord>);
      setStories((prev) => {
        const exists = prev.find((s) => s.id === editing.id);
        if (exists) return prev.map((s) => (s.id === editing.id ? saved : s));
        return [saved, ...prev];
      });
      toast.success(t("admin_dashboard.toast.saved"));
      setEditing(null);
    } catch (err) {
      console.error(err);
      toast.error(t("admin_dashboard.toast.save_failed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    if (isMock) {
      setStories((prev) => prev.filter((s) => s.id !== deleteId));
      toast.success(t("admin_dashboard.toast.deleted"));
      setDeleteId(null);
      return;
    }
    try {
      await deleteStory(deleteId);
      setStories((prev) => prev.filter((s) => s.id !== deleteId));
      toast.success(t("admin_dashboard.toast.deleted"));
    } catch (err) {
      console.error(err);
      toast.error(t("admin_dashboard.toast.delete_failed"));
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold bg-magic bg-clip-text text-transparent">
            {t("admin_dashboard.stories.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("admin_dashboard.stories.subtitle")}
          </p>
        </div>
        <Button onClick={() => setEditing(emptyStory())} className="gap-2 rounded-full shadow-soft hover-pop">
          <Plus className="h-4 w-4" />
          {t("admin_dashboard.stories.new")}
        </Button>
      </div>

      <Card className="border-2 border-kids-softPurple/40 dark:border-primary/20">
        <CardContent className="p-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("admin_dashboard.stories.search_placeholder")}
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
              <SelectItem value="all">{t("admin_dashboard.filter.all_status")}</SelectItem>
              <SelectItem value="published">{t("admin_dashboard.status.published")}</SelectItem>
              <SelectItem value="draft">{t("admin_dashboard.status.draft")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[200px] rounded-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin_dashboard.filter.all_categories")}</SelectItem>
              {STORY_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {t(`admin_dashboard.categories.${c}`, c)}
                </SelectItem>
              ))}
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
                  <TableHead>{t("admin_dashboard.table.title")}</TableHead>
                  <TableHead>{t("admin_dashboard.table.category")}</TableHead>
                  <TableHead>{t("admin_dashboard.table.age")}</TableHead>
                  <TableHead>{t("admin_dashboard.table.languages")}</TableHead>
                  <TableHead>{t("admin_dashboard.table.status")}</TableHead>
                  <TableHead>{t("admin_dashboard.table.views")}</TableHead>
                  <TableHead className="text-right">{t("admin_dashboard.table.actions")}</TableHead>
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
                      {t("admin_dashboard.empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((s) => {
                    const langCount = Object.values(s.title).filter((v) => !!v?.trim()).length;
                    return (
                      <TableRow key={s.id} className="hover:bg-kids-softPurple/20 dark:hover:bg-primary/5">
                        <TableCell className="font-medium">
                          {getLocalized(s.title, i18n.language) || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="rounded-full">
                            {s.category
                              ? t(`admin_dashboard.categories.${s.category}`, s.category)
                              : "—"}
                          </Badge>
                        </TableCell>
                        <TableCell>{s.age_range ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="rounded-full">
                            {langCount} / 6
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {s.published ? (
                            <Badge className="gap-1 rounded-full bg-magic border-0">
                              <CheckCircle2 className="h-3 w-3" />
                              {t("admin_dashboard.status.published")}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 rounded-full">
                              <Circle className="h-3 w-3" />
                              {t("admin_dashboard.status.draft")}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{(s.views ?? 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setPreviewing(s)}
                              title={t("admin_dashboard.actions.preview")}
                              className="rounded-full"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditing(s)}
                              title={t("admin_dashboard.actions.edit")}
                              className="rounded-full"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteId(s.id)}
                                title={t("admin_dashboard.actions.delete")}
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
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing?.id.startsWith("new-")
                ? t("admin_dashboard.stories.new")
                : t("admin_dashboard.stories.edit")}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-5">
              <MultilingualField
                label={t("admin_dashboard.field.title")}
                value={editing.title}
                onChange={(v: Multilingual) => setEditing({ ...editing, title: v })}
              />
              <MultilingualField
                label={t("admin_dashboard.field.description")}
                value={editing.description}
                onChange={(v) => setEditing({ ...editing, description: v })}
                multiline
                rows={2}
              />
              <MultilingualField
                label={t("admin_dashboard.field.content")}
                value={editing.content}
                onChange={(v) => setEditing({ ...editing, content: v })}
                multiline
                rows={6}
              />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>{t("admin_dashboard.field.age")}</Label>
                  <Select
                    value={editing.age_range ?? "3-5"}
                    onValueChange={(v) => setEditing({ ...editing, age_range: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AGE_RANGES.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("admin_dashboard.field.category")}</Label>
                  <Select
                    value={editing.category ?? "bedtime"}
                    onValueChange={(v) => setEditing({ ...editing, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STORY_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {t(`admin_dashboard.categories.${c}`, c)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("admin_dashboard.field.duration")}</Label>
                  <Input
                    value={editing.duration ?? ""}
                    onChange={(e) => setEditing({ ...editing, duration: e.target.value })}
                    placeholder="3 min"
                  />
                </div>
              </div>
              <FileUploadField
                label={t("admin_dashboard.field.image_url")}
                value={editing.image}
                onChange={(url) => setEditing({ ...editing, image: url })}
                uploader={uploadStoryImage}
                accept="image/*"
                uploadLabel={t("admin_dashboard.field.upload_image")}
                preview="image"
                disabled={isMock}
              />
              <FileUploadField
                label={t("admin_dashboard.field.audio_url")}
                value={editing.audio_url}
                onChange={(url) => setEditing({ ...editing, audio_url: url })}
                uploader={uploadStoryAudio}
                accept="audio/*"
                uploadLabel={t("admin_dashboard.field.upload_audio")}
                preview="audio"
                disabled={isMock}
              />
              <div className="space-y-2">
                <Label>Video Embed URL (YouTube / Vimeo / .mp4)</Label>
                <Input
                  value={(editing as StoryRecord).video_embed_url ?? ""}
                  onChange={(e) =>
                    setEditing({ ...editing, video_embed_url: e.target.value || null } as StoryItem)
                  }
                  placeholder="https://youtu.be/..."
                  dir="ltr"
                />
                <p className="text-xs text-muted-foreground">
                  {t("admin_stories.video_url_hint", "If you provide a video URL, an inline player will appear on the story page.")}
                </p>
              </div>
              <FileUploadField
                label={t("admin_stories.story_pdf_optional", "Story PDF (optional)")}
                value={(editing as StoryRecord).pdf_url ?? null}
                onChange={(url) => setEditing({ ...editing, pdf_url: url } as StoryItem)}
                uploader={uploadStoryPdf}
                accept="application/pdf"
                uploadLabel={t("admin_stories.upload_pdf_from_device", "Upload PDF from device")}
                preview="none"
                disabled={isMock}
              />
              <p className="text-xs text-muted-foreground -mt-1">
                {t("admin_stories.pdf_hint", "Upload a PDF containing all story pages; users will see a download/read button on the story page.")}
              </p>
              {isMock && (
                <p className="text-xs text-muted-foreground -mt-2">
                  {t("admin_dashboard.overview.using_mock")} — file upload requires live database mode (Settings).
                </p>
              )}
              <div className="flex items-center justify-between rounded-xl border-2 border-kids-softPurple/30 dark:border-primary/20 p-3">
                <div>
                  <Label className="text-base font-bold">{t("admin_dashboard.field.publish")}</Label>
                  <p className="text-xs text-muted-foreground">
                    {isAdmin
                      ? t("admin_dashboard.publish_hint_admin")
                      : t("admin_dashboard.publish_hint_editor")}
                  </p>
                </div>
                <Switch
                  checked={editing.published}
                  onCheckedChange={(v) => setEditing({ ...editing, published: v })}
                  disabled={!isAdmin}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>
              {t("admin_dashboard.actions.cancel")}
            </Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("admin_dashboard.actions.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview */}
      <Dialog open={!!previewing} onOpenChange={(o) => !o && setPreviewing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {previewing && getLocalized(previewing.title, i18n.language)}
            </DialogTitle>
          </DialogHeader>
          {previewing && (
            <div className="space-y-3">
              {previewing.image && (
                <img
                  src={previewing.image}
                  alt=""
                  className="w-full max-h-64 object-cover rounded-xl border-2 border-border"
                />
              )}
              <div className="flex gap-2 flex-wrap">
                {previewing.category && (
                  <Badge variant="outline">
                    {t(`admin_dashboard.categories.${previewing.category}`, previewing.category)}
                  </Badge>
                )}
                {previewing.age_range && <Badge variant="outline">{previewing.age_range}</Badge>}
                {previewing.duration && <Badge variant="outline">{previewing.duration}</Badge>}
              </div>
              <p className="text-muted-foreground italic">
                {getLocalized(previewing.description, i18n.language)}
              </p>
              <div className="whitespace-pre-wrap leading-relaxed">
                {getLocalized(previewing.content, i18n.language) ||
                  t("admin_dashboard.no_content")}
              </div>
              {previewing.audio_url && (
                <audio src={previewing.audio_url} controls className="w-full" />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin_dashboard.delete.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin_dashboard.delete.desc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin_dashboard.actions.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("admin_dashboard.actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
