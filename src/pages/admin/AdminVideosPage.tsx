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
  Upload,
  Link as LinkIcon,
  Play,
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import MultilingualField from "@/components/admin/MultilingualField";
import FileUploadField from "@/components/admin/FileUploadField";
import { MOCK_VIDEOS, type MockVideo } from "@/lib/adminMockData";
import { VIDEO_CATEGORIES, AGE_RANGES } from "@/lib/adminConstants";
import { getLocalized } from "@/lib/multilingual";
import { useAdminDataSource } from "@/hooks/useAdminDataSource";
import {
  fetchVideos,
  upsertVideo,
  deleteVideo,
  uploadVideoFile,
  uploadVideoThumbnail,
  type VideoRecord,
} from "@/lib/adminApi";

type VideoItem = MockVideo | VideoRecord;

const emptyVideo = (): MockVideo => ({
  id: `new-${Date.now()}`,
  title: {},
  description: {},
  thumbnail: null,
  video_url: "",
  source_type: "url",
  age_range: "3-5",
  category: "lullaby",
  duration: "",
  published: false,
  views: 0,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

export default function AdminVideosPage() {
  const { t, i18n } = useTranslation();
  const { isAdmin } = useOutletContext<{ isAdmin: boolean; isEditor: boolean }>();
  const { isMock } = useAdminDataSource();
  const [videos, setVideos] = useState<VideoItem[]>(MOCK_VIDEOS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [editing, setEditing] = useState<VideoItem | null>(null);
  const [previewing, setPreviewing] = useState<VideoItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (isMock) {
      setVideos(MOCK_VIDEOS);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchVideos()
      .then((data) => !cancelled && setVideos(data))
      .catch((err) => {
        console.error(err);
        toast.error(t("admin_dashboard.toast.load_failed"));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [isMock, t]);

  const filtered = useMemo(
    () =>
      videos.filter((v) => {
        const title = getLocalized(v.title, i18n.language).toLowerCase();
        if (search && !title.includes(search.toLowerCase())) return false;
        if (statusFilter === "published" && !v.published) return false;
        if (statusFilter === "draft" && v.published) return false;
        return true;
      }),
    [videos, search, statusFilter, i18n.language]
  );

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.title.en?.trim()) {
      toast.error(t("admin_dashboard.errors.english_required"));
      return;
    }
    if (!editing.video_url?.trim()) {
      toast.error(t("admin_dashboard.errors.video_url_required"));
      return;
    }
    if (isMock) {
      setVideos((prev) => {
        const exists = prev.find((v) => v.id === editing.id);
        if (exists) return prev.map((v) => (v.id === editing.id ? editing : v));
        return [editing, ...prev];
      });
      toast.success(t("admin_dashboard.toast.saved"));
      setEditing(null);
      return;
    }
    setSaving(true);
    try {
      const saved = await upsertVideo(editing as Partial<VideoRecord>);
      setVideos((prev) => {
        const exists = prev.find((v) => v.id === editing.id);
        if (exists) return prev.map((v) => (v.id === editing.id ? saved : v));
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
      setVideos((prev) => prev.filter((v) => v.id !== deleteId));
      toast.success(t("admin_dashboard.toast.deleted"));
      setDeleteId(null);
      return;
    }
    try {
      await deleteVideo(deleteId);
      setVideos((prev) => prev.filter((v) => v.id !== deleteId));
      toast.success(t("admin_dashboard.toast.deleted"));
    } catch (err) {
      console.error(err);
      toast.error(t("admin_dashboard.toast.delete_failed"));
    } finally {
      setDeleteId(null);
    }
  };

  const handleVideoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editing) return;
    if (isMock) {
      setEditing({
        ...editing,
        video_url: `mock-upload://${file.name}`,
        source_type: "upload",
      });
      toast.info(t("admin_dashboard.toast.upload_mock", { name: file.name }));
      return;
    }
    setUploadingVideo(true);
    try {
      const url = await uploadVideoFile(file);
      setEditing({ ...editing, video_url: url, source_type: "upload" });
      toast.success(t("admin_dashboard.toast.saved"));
    } catch (err) {
      console.error(err);
      toast.error(t("admin_dashboard.toast.upload_failed"));
    } finally {
      setUploadingVideo(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold bg-magic bg-clip-text text-transparent">
            {t("admin_dashboard.videos.title")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("admin_dashboard.videos.subtitle")}
          </p>
        </div>
        <Button onClick={() => setEditing(emptyVideo())} className="gap-2 rounded-full shadow-soft hover-pop">
          <Plus className="h-4 w-4" />
          {t("admin_dashboard.videos.new")}
        </Button>
      </div>

      <Card className="border-2 border-kids-softPurple/40 dark:border-primary/20">
        <CardContent className="p-4 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("admin_dashboard.videos.search_placeholder")}
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
                  <TableHead>{t("admin_dashboard.table.source")}</TableHead>
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
                  filtered.map((v) => (
                    <TableRow key={v.id} className="hover:bg-kids-softPurple/20 dark:hover:bg-primary/5">
                      <TableCell className="font-medium">
                        {getLocalized(v.title, i18n.language) || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-full">
                          {v.category
                            ? t(`admin_dashboard.categories.${v.category}`, v.category)
                            : "—"}
                        </Badge>
                      </TableCell>
                      <TableCell>{v.age_range ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="gap-1 rounded-full">
                          {v.source_type === "upload" ? (
                            <Upload className="h-3 w-3" />
                          ) : (
                            <LinkIcon className="h-3 w-3" />
                          )}
                          {t(`admin_dashboard.source.${v.source_type}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {v.published ? (
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
                      <TableCell>{(v.views ?? 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setPreviewing(v)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setEditing(v)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteId(v.id)}
                              className="rounded-full text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing?.id.startsWith("new-")
                ? t("admin_dashboard.videos.new")
                : t("admin_dashboard.videos.edit")}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-5">
              <MultilingualField
                label={t("admin_dashboard.field.title")}
                value={editing.title}
                onChange={(v) => setEditing({ ...editing, title: v })}
              />
              <MultilingualField
                label={t("admin_dashboard.field.description")}
                value={editing.description}
                onChange={(v) => setEditing({ ...editing, description: v })}
                multiline
                rows={3}
              />

              <div className="space-y-2">
                <Label>{t("admin_dashboard.field.video_source")}</Label>
                <Tabs
                  value={editing.source_type}
                  onValueChange={(v) =>
                    setEditing({
                      ...editing,
                      source_type: v as "url" | "upload",
                      video_url: "",
                    })
                  }
                >
                  <TabsList>
                    <TabsTrigger value="url" className="gap-1.5">
                      <LinkIcon className="h-3.5 w-3.5" />
                      {t("admin_dashboard.source.url")}
                    </TabsTrigger>
                    <TabsTrigger value="upload" className="gap-1.5">
                      <Upload className="h-3.5 w-3.5" />
                      {t("admin_dashboard.source.upload")}
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="url" className="mt-2">
                    <Input
                      value={editing.video_url ?? ""}
                      onChange={(e) => setEditing({ ...editing, video_url: e.target.value })}
                      placeholder="https://youtube.com/watch?v=... or https://...mp4"
                    />
                  </TabsContent>
                  <TabsContent value="upload" className="mt-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input type="file" accept="video/*" onChange={handleVideoFile} disabled={uploadingVideo} />
                      {uploadingVideo && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                    </div>
                    {editing.video_url && (
                      <p className="text-xs text-muted-foreground truncate">
                        {editing.video_url}
                      </p>
                    )}
                    {isMock && (
                      <p className="text-xs text-muted-foreground">
                        Live database mode required for real uploads (Settings).
                      </p>
                    )}
                  </TabsContent>
                </Tabs>
              </div>

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
                    value={editing.category ?? "lullaby"}
                    onValueChange={(v) => setEditing({ ...editing, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VIDEO_CATEGORIES.map((c) => (
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
                    placeholder="3:21"
                  />
                </div>
              </div>

              <FileUploadField
                label={t("admin_dashboard.field.thumbnail_url")}
                value={editing.thumbnail}
                onChange={(url) => setEditing({ ...editing, thumbnail: url })}
                uploader={uploadVideoThumbnail}
                accept="image/*"
                uploadLabel={t("admin_dashboard.field.upload_thumbnail")}
                preview="image"
                disabled={isMock}
              />

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

      <Dialog open={!!previewing} onOpenChange={(o) => !o && setPreviewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {previewing && getLocalized(previewing.title, i18n.language)}
            </DialogTitle>
          </DialogHeader>
          {previewing && (
            <div className="space-y-3">
              <div className="aspect-video bg-muted rounded-xl flex items-center justify-center overflow-hidden">
                {previewing.thumbnail ? (
                  <img src={previewing.thumbnail} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Play className="h-12 w-12 text-muted-foreground" />
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {previewing.category && (
                  <Badge variant="outline">
                    {t(`admin_dashboard.categories.${previewing.category}`, previewing.category)}
                  </Badge>
                )}
                {previewing.age_range && <Badge variant="outline">{previewing.age_range}</Badge>}
                {previewing.duration && <Badge variant="outline">{previewing.duration}</Badge>}
              </div>
              <p className="text-muted-foreground">
                {getLocalized(previewing.description, i18n.language)}
              </p>
              <p className="text-xs text-muted-foreground break-all">
                {previewing.video_url}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
