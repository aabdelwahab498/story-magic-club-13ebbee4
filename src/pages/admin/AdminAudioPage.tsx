import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Volume2, Trash2, Play, RefreshCw, Save, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAdminTrialOverrides } from "@/hooks/useAdminTrialOverrides";
import { useGenerateFullNarration } from "@/lib/storyTtsApi";
import { SUPPORTED_LANGUAGES } from "@/i18n/config";

interface AudioRow {
  id: string;
  title: string | null;
  language: string;
  audio_url: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

const SETTINGS_KEY = "starry-tales-admin-audio-settings";
const EVENT = "starry-tales-admin-audio-settings-change";

interface AudioSettings {
  defaultCharacter: string;
  autoNarrateOnGenerate: boolean;
  voiceOverrides: Record<string, string>; // lang -> voiceId
}

const DEFAULT_SETTINGS: AudioSettings = {
  defaultCharacter: "",
  autoNarrateOnGenerate: false,
  voiceOverrides: {},
};

function readSettings(): AudioSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function writeSettings(s: AudioSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  window.dispatchEvent(new Event(EVENT));
}

const CHARACTER_OPTIONS = [
  { value: "default", label: "Default narrator" },
  { value: "wizard", label: "Wizard 🧙" },
  { value: "fairy", label: "Fairy 🧚" },
  { value: "robot", label: "Robot 🤖" },
  { value: "dragon", label: "Dragon 🐉" },
  { value: "alien", label: "Alien 👽" },
];

const PAGE_SIZE = 10;

export default function AdminAudioPage() {
  const { overrides, update } = useAdminTrialOverrides();
  const [settings, setSettings] = useState<AudioSettings>(readSettings);
  const [rows, setRows] = useState<AudioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState<"with_audio" | "without_audio" | "all">("with_audio");
  const [search, setSearch] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);
  const [stats, setStats] = useState({ withAudio: 0, withoutAudio: 0, total: 0 });

  const narrate = useGenerateFullNarration();

  const load = async (pageIdx = 0, reset = true) => {
    setLoading(true);
    const from = pageIdx * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let q = supabase
      .from("ai_story_history")
      .select("id,title,language,audio_url,user_id,created_at,updated_at", { count: "exact" })
      .order("updated_at", { ascending: false });
    if (filter === "with_audio") q = q.not("audio_url", "is", null);
    if (filter === "without_audio") q = q.is("audio_url", null);
    if (search.trim()) q = q.ilike("title", `%${search.trim()}%`);
    const { data, error, count } = await q.range(from, to);
    if (error) {
      toast.error(error.message);
    } else {
      const list = (data as AudioRow[]) ?? [];
      setRows(reset ? list : [...rows, ...list]);
      setHasMore((from + list.length) < (count ?? 0));
      setPage(pageIdx);
    }
    setLoading(false);
  };

  const loadStats = async () => {
    const [{ count: total }, { count: withAudio }] = await Promise.all([
      supabase.from("ai_story_history").select("*", { count: "exact", head: true }),
      supabase.from("ai_story_history").select("*", { count: "exact", head: true }).not("audio_url", "is", null),
    ]);
    setStats({
      total: total ?? 0,
      withAudio: withAudio ?? 0,
      withoutAudio: (total ?? 0) - (withAudio ?? 0),
    });
  };

  useEffect(() => {
    load(0, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  useEffect(() => {
    loadStats();
  }, []);

  const persistSettings = (patch: Partial<AudioSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    writeSettings(next);
  };

  const handleClearAudio = async (id: string) => {
    if (!confirm("Clear narration audio for this story?")) return;
    setActingId(id);
    const { error } = await supabase
      .from("ai_story_history")
      .update({ audio_url: null })
      .eq("id", id);
    setActingId(null);
    if (error) return toast.error(error.message);
    toast.success("Audio cleared");
    setRows((r) => r.map((x) => (x.id === id ? { ...x, audio_url: null } : x)));
    loadStats();
  };

  const handleRegenerate = async (id: string) => {
    setActingId(id);
    try {
      await narrate.mutateAsync({ storyId: id, character: settings.defaultCharacter });
      await load(0, true);
      await loadStats();
    } finally {
      setActingId(null);
    }
  };

  const filteredRows = useMemo(() => rows, [rows]);

  return (
    <div className="space-y-6 animate-fade-in">
      <header>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Volume2 className="h-8 w-8 text-primary" />
          Audio &amp; Narration
        </h1>
        <p className="text-muted-foreground mt-1">
          Control the audio generation pipeline used by the AI Storyteller.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Total stories</CardDescription></CardHeader>
          <CardContent><p className="text-3xl font-bold">{stats.total}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>With narration</CardDescription></CardHeader>
          <CardContent><p className="text-3xl font-bold text-emerald-500">{stats.withAudio}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Missing narration</CardDescription></CardHeader>
          <CardContent><p className="text-3xl font-bold text-amber-500">{stats.withoutAudio}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" /> Generation controls</CardTitle>
          <CardDescription>These toggles affect the AI Storyteller page in real time.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-muted/30">
            <div>
              <Label className="text-base font-semibold">Audio generation enabled</Label>
              <p className="text-xs text-muted-foreground">When off, the narration button is hidden for admins running the trial flow.</p>
            </div>
            <Switch checked={overrides.audio} onCheckedChange={(v) => update({ audio: v })} />
          </div>

          <div className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-muted/30">
            <div>
              <Label className="text-base font-semibold">Auto-narrate after generation</Label>
              <p className="text-xs text-muted-foreground">Trigger full narration automatically when a new story finishes generating.</p>
            </div>
            <Switch
              checked={settings.autoNarrateOnGenerate}
              onCheckedChange={(v) => persistSettings({ autoNarrateOnGenerate: v })}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-base font-semibold">Default character voice</Label>
              <Select
                value={settings.defaultCharacter || "default"}
                onValueChange={(v) => persistSettings({ defaultCharacter: v === "default" ? "" : v })}
              >
                <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CHARACTER_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">Used when an admin re-narrates a story from this page.</p>
            </div>
          </div>

          <div>
            <Label className="text-base font-semibold">Per-language voice ID overrides</Label>
            <p className="text-xs text-muted-foreground mb-2">Leave blank to use the built-in default voice for that language.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {SUPPORTED_LANGUAGES.map((l) => (
                <div key={l.code} className="flex items-center gap-2">
                  <span className="w-16 text-sm font-mono">{l.flag} {l.code.toUpperCase()}</span>
                  <Input
                    placeholder="ElevenLabs voice id"
                    value={settings.voiceOverrides[l.code] ?? ""}
                    onChange={(e) =>
                      persistSettings({
                        voiceOverrides: { ...settings.voiceOverrides, [l.code]: e.target.value },
                      })
                    }
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-2">
              <Button size="sm" variant="outline" onClick={() => { writeSettings(settings); toast.success("Saved"); }}>
                <Save className="h-4 w-4 me-1" /> Save settings
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generated narrations</CardTitle>
          <CardDescription>Browse AI stories and manage their narration files.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="Search by title…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") load(0, true); }}
              className="sm:max-w-xs"
            />
            <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <SelectTrigger className="sm:max-w-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="with_audio">With narration</SelectItem>
                <SelectItem value="without_audio">Missing narration</SelectItem>
                <SelectItem value="all">All stories</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => load(0, true)}>
              <RefreshCw className="h-4 w-4 me-1" /> Refresh
            </Button>
          </div>

          {loading && rows.length === 0 ? (
            <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : filteredRows.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No stories match this filter.</p>
          ) : (
            <ul className="space-y-3">
              {filteredRows.map((row) => (
                <li key={row.id} className="p-4 rounded-xl border bg-card flex flex-col md:flex-row md:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold truncate">{row.title || "(untitled story)"}</p>
                      <Badge variant="outline" className="uppercase text-xs">{row.language}</Badge>
                      {row.audio_url ? (
                        <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Narrated</Badge>
                      ) : (
                        <Badge variant="secondary">No audio</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Updated {new Date(row.updated_at).toLocaleString()}</p>
                    {row.audio_url && (
                      <audio src={row.audio_url} controls className="w-full mt-2" preload="none" />
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={actingId === row.id || narrate.isPending}
                      onClick={() => handleRegenerate(row.id)}
                    >
                      {actingId === row.id && narrate.isPending
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Play className="h-4 w-4" />}
                      <span className="ms-1">{row.audio_url ? "Re-narrate" : "Generate"}</span>
                    </Button>
                    {row.audio_url && (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={actingId === row.id}
                        onClick={() => handleClearAudio(row.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {hasMore && (
            <div className="flex justify-center">
              <Button variant="outline" disabled={loading} onClick={() => load(page + 1, false)}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin me-1" /> : null}
                Load more
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
