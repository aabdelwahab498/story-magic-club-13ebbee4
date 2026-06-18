import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, FileType2 } from "lucide-react";
import { toast } from "sonner";
import { fetchPdfTemplates, upsertPdfTemplate, deletePdfTemplate, type PdfTemplate } from "@/lib/aiAdminApi";

export default function AdminPdfTemplatesPage() {
  const [items, setItems] = useState<PdfTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<PdfTemplate> | null>(null);

  const load = async () => {
    setLoading(true);
    try { setItems(await fetchPdfTemplates()); } catch { toast.error("Failed to load"); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing?.name || !editing?.slug) return toast.error("Name & slug required");
    try { await upsertPdfTemplate(editing); toast.success("Saved"); setEditing(null); load(); }
    catch (e: unknown) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><FileType2 className="h-7 w-7" /> PDF Templates</h1>
          <p className="text-muted-foreground">Branded PDF layouts for exports.</p>
        </div>
        <Button onClick={() => setEditing({ page_size: "A4", orientation: "portrait", active: true, branding: {}, layout: {} })}><Plus className="h-4 w-4 mr-2" />New Template</Button>
      </div>

      {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
        <div className="grid md:grid-cols-2 gap-4">
          {items.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{p.name} {p.is_default && <Badge>Default</Badge>}</CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditing(p)}>Edit</Button>
                    <Button variant="ghost" size="sm" onClick={async () => { if (confirm("Delete?")) { await deletePdfTemplate(p.id); load(); } }}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {p.description}<br/>
                <span className="text-xs">{p.page_size} · {p.orientation} · {p.active ? "Active" : "Inactive"}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <Card className="border-primary">
          <CardHeader><CardTitle>{editing.id ? "Edit" : "New"} Template</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-3">
              <div><Label>Name</Label><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div><Label>Slug</Label><Input value={editing.slug ?? ""} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} /></div>
            </div>
            <div><Label>Description</Label><Input value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></div>
            <div className="grid md:grid-cols-2 gap-3">
              <div><Label>Page Size</Label>
                <Select value={editing.page_size} onValueChange={(v) => setEditing({ ...editing, page_size: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["A4","Letter","Legal","A5"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Orientation</Label>
                <Select value={editing.orientation} onValueChange={(v) => setEditing({ ...editing, orientation: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["portrait","landscape"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Header HTML</Label><Textarea rows={3} value={editing.header_html ?? ""} onChange={(e) => setEditing({ ...editing, header_html: e.target.value })} /></div>
            <div><Label>Footer HTML</Label><Textarea rows={3} value={editing.footer_html ?? ""} onChange={(e) => setEditing({ ...editing, footer_html: e.target.value })} /></div>
            <div><Label>Branding (JSON: logo, colors, fonts)</Label><Textarea rows={4} value={JSON.stringify(editing.branding ?? {}, null, 2)} onChange={(e) => { try { setEditing({ ...editing, branding: JSON.parse(e.target.value) }); } catch { /* ignore */ } }} /></div>
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
