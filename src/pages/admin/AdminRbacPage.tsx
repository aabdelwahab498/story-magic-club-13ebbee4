import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { fetchPermissions, setPermission, type RbacPermission } from "@/lib/aiAdminApi";
import { useAuth } from "@/hooks/useAuth";

const ROLES = ["super_admin", "admin", "editor", "support", "user"];
const PERMISSIONS = [
  "manage_ai_settings",
  "manage_prompts",
  "generate_pdfs",
  "generate_audio",
  "view_analytics",
  "manage_users",
  "manage_rbac",
  "view_audit_logs",
];

export default function AdminRbacPage() {
  const [perms, setPerms] = useState<RbacPermission[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setPerms(await fetchPermissions()); } catch { toast.error("Failed to load"); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const matrix = useMemo(() => {
    const m: Record<string, Record<string, boolean>> = {};
    ROLES.forEach((r) => { m[r] = {}; PERMISSIONS.forEach((p) => { m[r][p] = false; }); });
    perms.forEach((p) => { if (m[p.role]) m[p.role][p.permission_key] = p.granted; });
    return m;
  }, [perms]);

  const toggle = async (role: string, perm: string, granted: boolean) => {
    try {
      await setPermission(role, perm, granted);
      toast.success(`${role} · ${perm} ${granted ? "granted" : "revoked"}`);
      load();
    } catch (e: unknown) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><ShieldCheck className="h-7 w-7" /> Role-Based Access Control</h1>
        <p className="text-muted-foreground">Grant fine-grained permissions to each role.</p>
      </div>

      {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : (
        <Card>
          <CardHeader><CardTitle>Permissions Matrix</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="p-2 text-left">Permission</th>
                    {ROLES.map((r) => <th key={r} className="p-2 text-center">{r}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSIONS.map((p) => (
                    <tr key={p} className="border-b">
                      <td className="p-2 font-mono text-xs">{p}</td>
                      {ROLES.map((r) => (
                        <td key={r} className="p-2 text-center">
                          <Switch checked={matrix[r][p]} onCheckedChange={(v) => toggle(r, p, v)} disabled={r === "super_admin"} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-3">Super Admins always have full access.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
