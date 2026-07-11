import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Copy,
  Save,
  KeyRound,
  Webhook,
  PlayCircle,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  getN8nSettings,
  updateN8nSettings,
  updateN8nSecret,
  testN8nWorkflow,
  type N8nSettings,
  type N8nWorkflowKind,
} from "@/lib/adminN8nApi";

const WORKFLOWS: { kind: N8nWorkflowKind; label: string; pathField: keyof N8nSettings; enabledField: keyof N8nSettings }[] = [
  { kind: "txt", label: "TXT (Plain text)", pathField: "txt_path", enabledField: "txt_enabled" },
  { kind: "mp3", label: "Audio (MP3)", pathField: "mp3_path", enabledField: "mp3_enabled" },
  { kind: "pdf", label: "PDF (Picture book)", pathField: "pdf_path", enabledField: "pdf_enabled" },
];

export default function AdminN8nIntegrationPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<N8nSettings | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [savingSecret, setSavingSecret] = useState(false);
  const [testing, setTesting] = useState<N8nWorkflowKind | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const s = await getN8nSettings();
        setSettings(s);
        setBaseUrl(s.webhook_base_url ?? "");
      } catch (e) {
        toast.error(`فشل تحميل الإعدادات: ${(e as Error).message}`);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (!settings) {
    return <div className="text-center text-muted-foreground py-20">لا توجد إعدادات</div>;
  }

  const patch = async (p: Parameters<typeof updateN8nSettings>[0]) => {
    setSaving(true);
    try {
      const next = await updateN8nSettings(p);
      setSettings(next);
      toast.success("تم الحفظ");
    } catch (e) {
      toast.error(`فشل الحفظ: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const saveBaseUrl = () => patch({ webhook_base_url: baseUrl.trim() || null });

  const saveSecret = async () => {
    if (secret.length < 8) {
      toast.error("السر يجب أن يكون 8 أحرف على الأقل");
      return;
    }
    setSavingSecret(true);
    try {
      await updateN8nSecret(secret);
      const s = await getN8nSettings();
      setSettings(s);
      setSecret("");
      toast.success("تم حفظ السر بشكل آمن");
    } catch (e) {
      toast.error(`فشل حفظ السر: ${(e as Error).message}`);
    } finally {
      setSavingSecret(false);
    }
  };

  const clearSecret = async () => {
    setSavingSecret(true);
    try {
      await updateN8nSecret(null);
      const s = await getN8nSettings();
      setSettings(s);
      toast.success("تم حذف السر");
    } catch (e) {
      toast.error(`فشل الحذف: ${(e as Error).message}`);
    } finally {
      setSavingSecret(false);
    }
  };

  const runTest = async (kind: N8nWorkflowKind) => {
    setTesting(kind);
    try {
      const r = await testN8nWorkflow(kind);
      const s = await getN8nSettings();
      setSettings(s);
      if (r.status === "ok") toast.success(`✅ ${kind.toUpperCase()}: ${r.message}`);
      else toast.error(`❌ ${kind.toUpperCase()}: ${r.message}`);
    } catch (e) {
      toast.error(`فشل الاختبار: ${(e as Error).message}`);
    } finally {
      setTesting(null);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("تم النسخ");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Webhook className="h-7 w-7 text-primary" />
          n8n Integration
        </h1>
        <p className="text-muted-foreground mt-1">
          إعداد webhook الخاص بـ n8n لتوليد ملفات TXT / MP3 / PDF. عند الإيقاف تعمل النسخة المحلية تلقائياً.
        </p>
      </div>

      {/* ── Connection ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" /> الاتصال بـ n8n
          </CardTitle>
          <CardDescription>
            الرابط الأساسي (Base URL) لـ n8n Webhook. يُلحق به مسار كل workflow.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Webhook Base URL</Label>
            <div className="flex gap-2">
              <Input
                dir="ltr"
                placeholder="https://your-instance.app.n8n.cloud/webhook/starry-tales"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
              <Button onClick={saveBaseUrl} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                حفظ
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              يجب أن يبدأ بـ <code>https://</code>. اتركه فارغاً لتعطيل n8n نهائياً واستخدام النسخة المحلية.
            </p>
          </div>

          <Separator />

          {/* Secret */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              الشيفرة السرية (X-Webhook-Secret)
              {settings.webhook_secret_set ? (
                <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">محفوظة</Badge>
              ) : (
                <Badge variant="outline">غير محفوظة</Badge>
              )}
            </Label>
            <div className="flex gap-2">
              <Input
                dir="ltr"
                type="password"
                placeholder={settings.webhook_secret_set ? "•••••••• (اكتب قيمة جديدة للتحديث)" : "أدخل شيفرة قوية"}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
              />
              <Button onClick={saveSecret} disabled={savingSecret || !secret} className="gap-2">
                {savingSecret ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                حفظ
              </Button>
              {settings.webhook_secret_set && (
                <Button variant="outline" onClick={clearSecret} disabled={savingSecret}>
                  حذف
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              تُخزَّن مشفرة على الخادم ولا تُعرَض أبداً في الواجهة. يجب أن تكون نفس القيمة في عقدة Webhook داخل n8n
              تحت header اسمه <code>X-Webhook-Secret</code>.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Workflows ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>مسارات الـ Workflows</CardTitle>
          <CardDescription>
            لكل نوع تصدير مسار مستقل. يمكنك تعطيله فيعمل النظام تلقائياً بالنسخة المحلية.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {WORKFLOWS.map((w) => {
            const path = settings[w.pathField] as string;
            const enabled = settings[w.enabledField] as boolean;
            const fullUrl = settings.webhook_base_url
              ? `${settings.webhook_base_url.replace(/\/$/, "")}${path}`
              : "";
            return (
              <div key={w.kind} className="rounded-xl border p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold flex items-center gap-2">
                      {w.label}
                      {enabled ? (
                        <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">مفعّل</Badge>
                      ) : (
                        <Badge variant="secondary">معطّل (نسخة محلية)</Badge>
                      )}
                    </div>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(v) => patch({ [w.enabledField]: v } as never)}
                  />
                </div>
                <div className="flex gap-2 items-center">
                  <Label className="w-24 text-xs text-muted-foreground">Path</Label>
                  <Input
                    dir="ltr"
                    className="font-mono text-sm"
                    value={path}
                    onChange={(e) =>
                      setSettings({ ...settings, [w.pathField]: e.target.value } as N8nSettings)
                    }
                    onBlur={() => patch({ [w.pathField]: path } as never)}
                  />
                </div>
                {fullUrl && (
                  <div className="flex gap-2 items-center bg-muted/50 rounded-lg p-2">
                    <code dir="ltr" className="text-xs flex-1 truncate">{fullUrl}</code>
                    <Button size="sm" variant="ghost" onClick={() => copy(fullUrl)} className="gap-1">
                      <Copy className="h-3 w-3" /> نسخ
                    </Button>
                  </div>
                )}
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runTest(w.kind)}
                    disabled={testing !== null || !settings.webhook_base_url}
                    className="gap-2"
                  >
                    {testing === w.kind ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <PlayCircle className="h-4 w-4" />
                    )}
                    اختبار الاتصال
                  </Button>
                </div>
              </div>
            );
          })}

          {settings.last_tested_at && (
            <div className="text-xs text-muted-foreground flex items-center gap-2 pt-2">
              {settings.last_test_status === "ok" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              آخر اختبار: {new Date(settings.last_tested_at).toLocaleString()} —{" "}
              {settings.last_test_message}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Help ─────────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle>خطوات الإعداد داخل n8n</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>افتح n8n Cloud وأنشئ 3 workflows، ولكل واحد ابدأ بعقدة Webhook.</li>
            <li>
              اضبط المسار (Path) في كل عقدة بحيث يتطابق مع الجدول أعلاه (
              <code>/export-txt</code>, <code>/export-audio</code>, <code>/export-pdf</code>).
            </li>
            <li>
              في تبويب <b>Authentication → Header Auth</b>، أضف header اسمه{" "}
              <code>X-Webhook-Secret</code> وقيمته نفس السر الذي حفظته هنا.
            </li>
            <li>احفظ الـ workflows وفعّلها (Active) في n8n.</li>
            <li>ارجع هنا واضغط <b>اختبار الاتصال</b> للتأكد.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
