import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, ToggleRight } from "lucide-react";
import { toast } from "sonner";
import { fetchFeatureToggles, setFeatureToggle, logAudit, type AiFeatureToggle } from "@/lib/aiAdminApi";

export default function AdminAiFeatureTogglesPage() {
  const [items, setItems] = useState<AiFeatureToggle[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setItems(await fetchFeatureToggles()); } catch { toast.error("Failed to load"); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggle = async (t: AiFeatureToggle, enabled: boolean) => {
    setItems((prev) => prev.map((x) => (x.id === t.id ? { ...x, enabled } : x)));
    try {
      await setFeatureToggle(t.feature_key, enabled);
      await logAudit("toggle_feature", "ai_feature_toggle", t.id, { enabled: t.enabled }, { enabled });
      toast.success(`${t.label} ${enabled ? "enabled" : "disabled"}`);
    } catch (e: unknown) {
      toast.error((e as Error).message);
      load();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><ToggleRight className="h-7 w-7" /> Feature Toggles</h1>
        <p className="text-muted-foreground">Enable or disable AI capabilities across the entire platform.</p>
      </div>

      {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
        <div className="grid md:grid-cols-2 gap-4">
          {items.map((t) => (
            <Card key={t.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    {t.label}
                    <Badge variant={t.enabled ? "default" : "secondary"}>{t.enabled ? "ON" : "OFF"}</Badge>
                  </CardTitle>
                  <Switch checked={t.enabled} onCheckedChange={(v) => toggle(t, v)} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t.description}</p>
                <p className="text-xs text-muted-foreground mt-1 font-mono">{t.feature_key}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
