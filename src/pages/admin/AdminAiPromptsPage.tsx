import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, FileText, History, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  fetchPromptTemplates,
  upsertPromptTemplate,
  deletePromptTemplate,
  fetchPromptVersions,
  rollbackPromptVersion,
  logAudit,
  type AiPromptTemplate,
  type AiPromptVersion,
} from "@/lib/aiAdminApi";

export default function AdminAiPromptsPage() {
  const [items, setItems] = useState<AiPromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<AiPromptTemplate> | null>(null);
  const [versionsFor, setVersionsFor] = useState<string | null>(null);
  const [versions, setVersions] = useState<AiPromptVersion[]>([]);
  const [preview, setPreview] = useState("");

  const load = async () => {
    setLoading(true);
    try { setItems(await fetchPromptTemplates()); } catch { toast.error("Failed to load"); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing?.name || !editing?.slug) return toast.error("Name and slug required");
    try {
      await upsertPromptTemplate(editing);
      await logAudit(editing.id ? "update_prompt" : "create_prompt", "ai_prompt_template", editing.id ?? null, null, editing);
      toast.success("Saved (new version snapshot created)");
      setEditing(null); load();
    } catch (e: unknown) { toast.error((e as Error).message); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete prompt template and all its versions?")) return;
    try { await deletePromptTemplate(id); await logAudit("delete_prompt", "ai_prompt_template", id, null, null); load(); }
    catch (e: unknown) { toast.error((e as Error).message); }
  };

  const showVersions = async (id: string) => {
    setVersionsFor(id);
    try { setVersions(await fetchPromptVersions(id)); } catch { toast.error("Failed to load versions"); }
  };

  const rollback = async (templateId: string, versionId: string) => {
    if (!confirm("Roll back to this version?")) return;
    try {
      await rollbackPromptVersion(templateId, versionId);
      await logAudit("rollback_prompt", "ai_prompt_template", templateId, null, { versionId });
      toast.success("Rolled back");
      setVersionsFor(null); load();
    } catch (e: unknown) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><FileText className="h-7 w-7" /> Prompt Templates</h1>
          <p className="text-muted-foreground">Versioned prompts with rollback and live preview.</p>
        </div>
        <Button onClick={() => setEditing({ category: "general", active: true })}><Plus className="h-4 w-4 mr-2" /> New Prompt</Button>
      </div>

      {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
        <div className="grid gap-4">
          {items.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{p.name} <Badge variant="outline">{p.category}</Badge> <Badge>v{p.current_version}</Badge></CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">{p.slug}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => showVersions(p.id)}><History className="h-4 w-4" /></Button>
                    <Button variant="outline" size="sm" onClick={() => setEditing(p)}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent><pre className="text-xs bg-muted p-3 rounded line-clamp-4 whitespace-pre-wrap">{p.body}</pre></CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <Card className="border-primary">
          <CardHeader><CardTitle>{editing.id ? "Edit Prompt" : "New Prompt"}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-3 gap-4">
              <div><Label>Name</Label><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>Slug</Label><Input value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} /></div>
              <div><Label>Category</Label><Input value={editing.category ?? ""} onChange={(e) => setEditing({ ...editing, category: e.target.value })} /></div>
            </div>
            <div><Label>Body</Label><Textarea rows={10} value={editing.body ?? ""} onChange={(e) => { setEditing({ ...editing, body: e.target.value }); setPreview(e.target.value); }} /></div>
            {preview && (<div><Label>Live Preview</Label><div className="p-4 bg-muted rounded text-sm whitespace-pre-wrap">{preview || editing.body}</div></div>)}
            <div className="flex gap-2"><Button onClick={save}>Save</Button><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button></div>
          </CardContent>
        </Card>
      )}

      {versionsFor && (
        <Card>
          <CardHeader><CardTitle>Version History</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {versions.length === 0 && <p className="text-sm text-muted-foreground">No previous versions yet.</p>}
            {versions.map((v) => (
              <div key={v.id} className="border rounded p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div><Badge>v{v.version_no}</Badge> <span className="text-xs text-muted-foreground ml-2">{new Date(v.created_at).toLocaleString()}</span></div>
                  <Button size="sm" variant="outline" onClick={() => rollback(versionsFor, v.id)}><RotateCcw className="h-4 w-4 mr-1" /> Rollback</Button>
                </div>
                <pre className="text-xs bg-muted p-2 rounded line-clamp-4 whitespace-pre-wrap">{v.body}</pre>
              </div>
            ))}
            <Button variant="ghost" onClick={() => setVersionsFor(null)}>Close</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
