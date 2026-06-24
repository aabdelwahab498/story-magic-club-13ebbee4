import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Download,
  Search,
  Trash2,
  FileType,
  Headphones,
  FileText,
  FileType2,
  BookOpen,
  Images as ImagesIcon,
  Package,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Seo from "@/components/Seo";
import {
  fetchDownloadHistory,
  deleteDownloadHistoryRow,
  type DownloadFormat,
  type DownloadHistoryRow,
} from "@/lib/storyDownloads";

const FORMAT_ICON: Record<DownloadFormat, typeof FileType> = {
  pdf: FileType,
  mp3: Headphones,
  txt: FileText,
  docx: FileType2,
  epub: BookOpen,
  images: ImagesIcon,
  pack: Package,
};

const FORMAT_LABEL: Record<DownloadFormat, string> = {
  pdf: "PDF",
  mp3: "MP3",
  txt: "TXT",
  docx: "DOCX",
  epub: "EPUB",
  images: "Images",
  pack: "Pack",
};

export default function MyDownloads() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | DownloadFormat>("all");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["download-history", user?.id],
    enabled: !!user,
    queryFn: () => fetchDownloadHistory(user!.id),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.format !== filter) return false;
      if (!q) return true;
      return (r.story_title ?? "").toLowerCase().includes(q);
    });
  }, [rows, search, filter]);

  const handleDelete = async (id: string) => {
    try {
      await deleteDownloadHistoryRow(id);
      await qc.invalidateQueries({ queryKey: ["download-history", user?.id] });
      toast.success(t("downloads.history.deleted", { defaultValue: "Removed from history" }));
    } catch {
      toast.error(t("downloads.failed", { defaultValue: "Failed" }));
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
      <Seo
        title={`${t("downloads.history.title", { defaultValue: "My Downloads" })} — NajmaH`}
        description={t("downloads.history.seo", {
          defaultValue: "Your story download history on NajmaH.",
        })}
      />

      <header className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm" className="gap-1">
            <Link to="/my-stories">
              <ArrowLeft className="h-4 w-4" />
              {t("downloads.history.back", { defaultValue: "Back" })}
            </Link>
          </Button>
          <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-2">
            <Download className="h-6 w-6 text-primary" />
            {t("downloads.history.title", { defaultValue: "My Downloads" })}
          </h1>
        </div>
        <Badge variant="secondary">{rows.length}</Badge>
      </header>

      <Card className="p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("downloads.history.search", { defaultValue: "Search by story title…" })}
            className="ps-10"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {t("downloads.history.all", { defaultValue: "All formats" })}
            </SelectItem>
            {(Object.keys(FORMAT_LABEL) as DownloadFormat[]).map((k) => (
              <SelectItem key={k} value={k}>
                {FORMAT_LABEL[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          {rows.length === 0
            ? t("downloads.history.empty", {
                defaultValue: "You haven't downloaded any stories yet.",
              })
            : t("downloads.history.no_match", {
                defaultValue: "No downloads match your filters.",
              })}
        </Card>
      ) : (
        <ul className="space-y-2">
          {filtered.map((r) => (
            <HistoryRow key={r.id} row={r} locale={i18n.language} onDelete={handleDelete} />
          ))}
        </ul>
      )}
    </div>
  );
}

function HistoryRow({
  row,
  locale,
  onDelete,
}: {
  row: DownloadHistoryRow;
  locale: string;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation();
  const Icon = FORMAT_ICON[row.format] ?? FileType;
  const sizeKb =
    row.file_size_bytes && row.file_size_bytes > 0
      ? `${Math.round(row.file_size_bytes / 1024).toLocaleString()} KB`
      : null;

  return (
    <Card className="p-4 flex items-center gap-3 flex-wrap">
      <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-foreground truncate">
          {row.story_title ?? t("downloads.history.untitled", { defaultValue: "Untitled story" })}
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
          <Badge variant="outline" className="text-[10px] py-0">
            {FORMAT_LABEL[row.format]}
          </Badge>
          <span>{new Date(row.created_at).toLocaleString(locale)}</span>
          {sizeKb && <span>• {sizeKb}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {row.story_id && (
          <Button asChild size="sm" variant="outline" className="gap-1">
            <Link to={`/my-stories/${row.story_id}`}>
              <Download className="h-4 w-4" />
              {t("downloads.history.again", { defaultValue: "Download again" })}
            </Link>
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onDelete(row.id)}
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
    </Card>
  );
}
