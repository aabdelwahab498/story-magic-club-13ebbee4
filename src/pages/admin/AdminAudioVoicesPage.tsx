import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, Volume2, Play } from "lucide-react";
import { toast } from "sonner";
import { fetchVoices, upsertVoice, deleteVoice, type VoiceProfile } from "@/lib/aiAdminApi";

const PROVIDERS = ["openai", "elevenlabs", "google", "gemini"];

export default function AdminAudioVoicesPage() {
  const [items, setItems] = useState<VoiceProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<VoiceProfile> | null>(null);

  const load = async () => {
    setLoading(true);
    try { setItems(await fetchVoices()); } catch { toast.error("Failed to load"); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing?.name || !editing?.voice_id) return toast.error("Name & voice_id required");
    try { await upsertVoice(editing); toast.success("Saved"); setEditing(null); load(); }
    catch (e: unknown) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Volume2 className="h-7 w-7" /> Voice Profiles</h1>
          <p className="text-muted-foreground">Manage TTS voices and providers.</p>
        </div>
        <Button onClick={() => setEditing({ provider: "openai", language: "en", active: true })}><Plus className="h-4 w-4 mr-2" />New Voice</Button>
      </div>

      {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
        <div className="grid md:grid-cols-2 gap-4">
          {items.map((v) => (
            <Card key={v.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{v.name} {v.is_default && <Badge>Default</Badge>}</CardTitle>
                  <div className="flex gap-2">
                    {v.sample_url && <Button variant="outline" size="sm" onClick={() => new Audio(v.sample_url!).play()}><Play className="h-4 w-4" /></Button>}
                    <Button variant="outline" size="sm" onClick={() => setEditing(v)}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={async () => { if (confirm("Delete?")) { await deleteVoice(v.id); load(); } }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <div><Badge variant="outline">{v.provider}</Badge> <Badge variant="secondary">{v.language}</Badge></div>
                <div className="text-xs text-muted-foreground font-mono">{v.voice_id}</div>
                {v.description && <p className="text-muted-foreground">{v.description}</p>}
              </CardContent>
            </Card>
          ))}
          {items.length === 0 && <p className="text-muted-foreground">No voice profiles yet — add one to start.</p>}
        </div>
      )}

      {editing && (
        <Card className="border-primary">
          <CardHeader><CardTitle>{editing.id ? "Edit" : "New"} Voice</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div><Label>Name</Label><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>Provider</Label>
                <Select value={editing.provider} onValueChange={(v) => setEditing({ ...editing, provider: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PROVIDERS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <div><Label>Voice ID</Label><Input value={editing.voice_id ?? ""} onChange={(e) => setEditing({ ...editing, voice_id: e.target.value })} /></div>
              <div><Label>Language</Label><Input value={editing.language ?? ""} onChange={(e) => setEditing({ ...editing, language: e.target.value })} /></div>
              <div><Label>Gender</Label><Input value={editing.gender ?? ""} onChange={(e) => setEditing({ ...editing, gender: e.target.value })} /></div>
            </div>
            <div><Label>Sample URL</Label><Input value={editing.sample_url ?? ""} onChange={(e) => setEditing({ ...editing, sample_url: e.target.value })} /></div>
            <div><Label>Description</Label><Input value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2"><Switch checked={editing.active ?? true} onCheckedChange={(v) => setEditing({ ...editing, active: v })} /> Active</label>
              <label className="flex items-center gap-2"><Switch checked={editing.is_default ?? false} onCheckedChange={(v) => setEditing({ ...editing, is_default: v })} /> Default</label>
            </div>
            <div className="flex gap-2"><Button onClick={save}>Save</Button><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
