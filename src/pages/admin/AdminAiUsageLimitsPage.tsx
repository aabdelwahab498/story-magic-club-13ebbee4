import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, Gauge } from "lucide-react";
import { toast } from "sonner";
import { fetchUsageLimits, upsertUsageLimit, deleteUsageLimit, type AiUsageLimit } from "@/lib/aiAdminApi";

const FEATURES = ["pdf_generation","audio_generation","file_downloads","image_generation","ai_chat","ai_summaries","ai_translation","ai_writing"];
const SCOPES = ["global","role","user"] as const;
const ROLES = ["admin","editor","support","user"];

export default function AdminAiUsageLimitsPage() {
  const [items, setItems] = useState<AiUsageLimit[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<AiUsageLimit> | null>(null);

  const load = async () => {
    setLoading(true);
    try { setItems(await fetchUsageLimits()); } catch { toast.error("Failed to load"); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try { await upsertUsageLimit(editing!); toast.success("Saved"); setEditing(null); load(); }
    catch (e: unknown) { toast.error((e as Error).message); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete?")) return;
    await deleteUsageLimit(id); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Gauge className="h-7 w-7" /> Usage Limits</h1>
          <p className="text-muted-foreground">Daily and monthly request quotas — global, per role, or per user.</p>
        </div>
        <Button onClick={() => setEditing({ scope: "global", daily_limit: 100, monthly_limit: 1000 })}><Plus className="h-4 w-4 mr-2" />New Limit</Button>
      </div>

      {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
        <div className="grid gap-3">
          {items.map((l) => (
            <Card key={l.id}>
              <CardContent className="pt-4 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge>{l.scope}</Badge>
                    {l.role && <Badge variant="outline">role: {l.role}</Badge>}
                    {l.user_id && <Badge variant="outline">user: {l.user_id.slice(0,8)}</Badge>}
                    {l.feature_key && <Badge variant="secondary">{l.feature_key}</Badge>}
                  </div>
                  <p className="text-sm">Daily: <b>{l.daily_limit ?? "∞"}</b> · Monthly: <b>{l.monthly_limit ?? "∞"}</b></p>
                  {l.notes && <p className="text-xs text-muted-foreground">{l.notes}</p>}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(l)}>Edit</Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(l.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <Card className="border-primary">
          <CardHeader><CardTitle>{editing.id ? "Edit Limit" : "New Limit"}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid md:grid-cols-3 gap-3">
              <div><Label>Scope</Label>
                <Select value={editing.scope} onValueChange={(v) => setEditing({ ...editing, scope: v as AiUsageLimit["scope"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SCOPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {editing.scope === "role" && (
                <div><Label>Role</Label>
                  <Select value={editing.role ?? ""} onValueChange={(v) => setEditing({ ...editing, role: v })}>
                    <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                    <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
              {editing.scope === "user" && (
                <div><Label>User ID (UUID)</Label><Input value={editing.user_id ?? ""} onChange={(e) => setEditing({ ...editing, user_id: e.target.value })} /></div>
              )}
              <div><Label>Feature (optional)</Label>
                <Select value={editing.feature_key ?? ""} onValueChange={(v) => setEditing({ ...editing, feature_key: v || null })}>
                  <SelectTrigger><SelectValue placeholder="All features" /></SelectTrigger>
                  <SelectContent>{FEATURES.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <div><Label>Daily limit</Label><Input type="number" value={editing.daily_limit ?? ""} onChange={(e) => setEditing({ ...editing, daily_limit: e.target.value ? Number(e.target.value) : null })} /></div>
              <div><Label>Monthly limit</Label><Input type="number" value={editing.monthly_limit ?? ""} onChange={(e) => setEditing({ ...editing, monthly_limit: e.target.value ? Number(e.target.value) : null })} /></div>
            </div>
            <div><Label>Notes</Label><Input value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></div>
            <div className="flex gap-2"><Button onClick={save}>Save</Button><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
