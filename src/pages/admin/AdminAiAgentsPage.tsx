import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2, Bot } from "lucide-react";
import { toast } from "sonner";
import {
  fetchAgents,
  upsertAgent,
  deleteAgent,
  logAudit,
  type AiAgent,
  type AiTone,
} from "@/lib/aiAdminApi";

const TONES: AiTone[] = ["professional", "friendly", "educational", "marketing", "custom"];
const MODELS = [
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-pro",
  "google/gemini-2.5-flash",
  "openai/gpt-5-mini",
  "openai/gpt-5",
];

export default function AdminAiAgentsPage() {
  const [agents, setAgents] = useState<AiAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<AiAgent> | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setAgents(await fetchAgents());
    } catch (e) {
      toast.error("Failed to load agents");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!editing?.name || !editing?.slug) return toast.error("Name and slug required");
    try {
      await upsertAgent(editing);
      await logAudit(editing.id ? "update_agent" : "create_agent", "ai_agent", editing.id ?? null, null, editing);
      toast.success("Saved");
      setEditing(null);
      load();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this agent?")) return;
    try {
      await deleteAgent(id);
      await logAudit("delete_agent", "ai_agent", id, null, null);
      toast.success("Deleted");
      load();
    } catch (e: unknown) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Bot className="h-7 w-7" /> AI Agents</h1>
          <p className="text-muted-foreground">Manage AI personas, prompts, tones and models.</p>
        </div>
        <Button onClick={() => setEditing({ tone: "friendly", temperature: 0.7, max_tokens: 2048, active: true, model: MODELS[0] })}>
          <Plus className="h-4 w-4 mr-2" /> New Agent
        </Button>
      </div>

      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin" />
      ) : (
        <div className="grid gap-4">
          {agents.map((a) => (
            <Card key={a.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {a.name}
                      {a.is_default && <Badge>Default</Badge>}
                      {!a.active && <Badge variant="secondary">Inactive</Badge>}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{a.description}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing(a)}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <div><span className="text-muted-foreground">Tone:</span> {a.tone} · <span className="text-muted-foreground">Model:</span> {a.model} · <span className="text-muted-foreground">Temp:</span> {a.temperature}</div>
                <div className="line-clamp-2 text-muted-foreground">{a.system_prompt}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <Card className="border-primary">
          <CardHeader><CardTitle>{editing.id ? "Edit Agent" : "New Agent"}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div><Label>Name</Label><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>Slug</Label><Input value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} /></div>
            </div>
            <div><Label>Description</Label><Input value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
            <div><Label>System Prompt</Label><Textarea rows={6} value={editing.system_prompt ?? ""} onChange={(e) => setEditing({ ...editing, system_prompt: e.target.value })} /></div>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <Label>Tone</Label>
                <Select value={editing.tone} onValueChange={(v) => setEditing({ ...editing, tone: v as AiTone })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TONES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Model</Label>
                <Select value={editing.model} onValueChange={(v) => setEditing({ ...editing, model: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MODELS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Temperature</Label>
                <Input type="number" step="0.1" min="0" max="2" value={editing.temperature ?? 0.7} onChange={(e) => setEditing({ ...editing, temperature: Number(e.target.value) })} />
              </div>
            </div>
            {editing.tone === "custom" && (
              <div><Label>Custom tone description</Label><Input value={editing.custom_tone_text ?? ""} onChange={(e) => setEditing({ ...editing, custom_tone_text: e.target.value })} /></div>
            )}
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
