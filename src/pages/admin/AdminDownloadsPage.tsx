import { useEffect, useState } from "react";
import { Loader2, Save, Download as DownloadIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  fetchDownloadSettings,
  updateDownloadSettings,
  DEFAULT_DOWNLOAD_SETTINGS,
  type DownloadSettings,
} from "@/lib/storyDownloads";

const FORMATS: { key: keyof DownloadSettings; label: string; desc: string }[] = [
  { key: "enable_pdf", label: "PDF", desc: "Designed PDF export" },
  { key: "enable_mp3", label: "MP3", desc: "Narration audio download" },
  { key: "enable_txt", label: "TXT", desc: "Plain text (always free)" },
  { key: "enable_docx", label: "DOCX", desc: "Microsoft Word document" },
  { key: "enable_epub", label: "EPUB", desc: "E-reader format" },
  { key: "enable_images", label: "Images (ZIP)", desc: "Illustrations bundle" },
  { key: "enable_pack", label: "Complete Pack", desc: "All formats bundled" },
];

export default function AdminDownloadsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<DownloadSettings>(DEFAULT_DOWNLOAD_SETTINGS);

  useEffect(() => {
    (async () => {
      try {
        const s = await fetchDownloadSettings();
        setSettings(s);
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const update = <K extends keyof DownloadSettings>(k: K, v: DownloadSettings[K]) =>
    setSettings((s) => ({ ...s, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await updateDownloadSettings(settings);
      toast.success("Download settings saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <DownloadIcon className="h-6 w-6 text-primary" />
          <h1 className="text-2xl md:text-3xl font-bold">Download Management</h1>
        </div>
        <p className="text-muted-foreground">
          Control which download formats users can access, plus per-user daily and file-size limits.
        </p>
      </header>

      <section className="bg-card border rounded-2xl p-5 shadow-sm space-y-1">
        <h2 className="text-lg font-bold mb-3">Available formats</h2>
        <div className="divide-y">
          {FORMATS.map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between py-3">
              <div className="min-w-0">
                <p className="font-semibold">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Switch
                checked={settings[key] as boolean}
                onCheckedChange={(v) => update(key, v as never)}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="bg-card border rounded-2xl p-5 shadow-sm space-y-4">
        <h2 className="text-lg font-bold">Limits</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="daily">Daily downloads per user</Label>
            <Input
              id="daily"
              type="number"
              min={1}
              max={1000}
              value={settings.daily_limit_per_user}
              onChange={(e) =>
                update("daily_limit_per_user", Math.max(1, Number(e.target.value) || 1))
              }
            />
            <p className="text-xs text-muted-foreground mt-1">
              Max successful downloads logged per user in 24h.
            </p>
          </div>
          <div>
            <Label htmlFor="size">Max file size (MB)</Label>
            <Input
              id="size"
              type="number"
              min={1}
              max={2048}
              value={settings.max_file_size_mb}
              onChange={(e) =>
                update("max_file_size_mb", Math.max(1, Number(e.target.value) || 1))
              }
            />
            <p className="text-xs text-muted-foreground mt-1">
              Soft cap surfaced to clients for generated bundles.
            </p>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="gap-2 rounded-full">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save changes
        </Button>
      </div>
    </div>
  );
}
