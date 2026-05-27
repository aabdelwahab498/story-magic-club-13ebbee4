import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Database, ShieldCheck, User, LogOut, FlaskConical, FileText, Volume2, Palette, BookOpen } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAdminDataSource } from "@/hooks/useAdminDataSource";
import { useAdminTrialOverrides } from "@/hooks/useAdminTrialOverrides";
import { toast } from "sonner";
import SocialLinksManager from "@/components/admin/SocialLinksManager";

export default function AdminSettingsPage() {
  const { t, i18n } = useTranslation();
  const { user, roles, signOut, isAdmin } = useAuth();
  const { isMock, setSource } = useAdminDataSource();
  const { overrides, update } = useAdminTrialOverrides();

  const trialToggles: Array<{ key: keyof typeof overrides; icon: typeof FileText; labelAr: string; labelEn: string; descAr: string; descEn: string }> = [
    { key: "createStory", icon: BookOpen, labelAr: "إنشاء القصص", labelEn: "Create stories", descAr: "تجاوز الحد الشهري للقصص أثناء التجربة.", descEn: "Bypass monthly story limit while testing." },
    { key: "illustrations", icon: Palette, labelAr: "توليد الرسومات", labelEn: "Illustrations", descAr: "تفعيل زر توليد الصور للقصص.", descEn: "Enable AI illustration button." },
    { key: "pdf", icon: FileText, labelAr: "تصدير PDF", labelEn: "PDF export", descAr: "تفعيل تنزيل القصة كملف PDF.", descEn: "Enable PDF download for stories." },
    { key: "audio", icon: Volume2, labelAr: "السرد الصوتي", labelEn: "Audio narration", descAr: "تفعيل قراءة القصة صوتيًا.", descEn: "Enable text-to-speech narration." },
  ];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold bg-magic bg-clip-text text-transparent">
          {t("admin_dashboard.settings.title")}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t("admin_dashboard.settings.subtitle")}
        </p>
      </div>

      <Card className="border-2 border-kids-softPurple/40 dark:border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            {t("admin_dashboard.settings.account")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">
                {t("admin_dashboard.settings.signed_in_as")}
              </div>
              <div className="font-bold">{user?.email ?? "—"}</div>
            </div>
            <Button variant="outline" size="sm" onClick={signOut} className="gap-2 rounded-full">
              <LogOut className="h-4 w-4" />
              {t("nav.sign_out")}
            </Button>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1.5">
              {t("admin_dashboard.settings.your_roles")}
            </div>
            <div className="flex gap-2 flex-wrap">
              {roles.length === 0 ? (
                <Badge variant="outline">{t("admin_dashboard.settings.no_roles")}</Badge>
              ) : (
                roles.map((r) => (
                  <Badge
                    key={r}
                    variant={r === "admin" ? "default" : "secondary"}
                    className={r === "admin" ? "bg-magic border-0" : ""}
                  >
                    {t(`admin_dashboard.role.${r}`, r)}
                  </Badge>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-kids-softPurple/40 dark:border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" />
            {t("admin_dashboard.settings.data_source")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border-2 border-kids-softPurple/30 dark:border-primary/20 p-4 bg-kids-softPurple/10 dark:bg-primary/5">
            <div>
              <Label className="text-base font-bold">{t("admin_dashboard.settings.use_mock")}</Label>
              <p className="text-xs text-muted-foreground mt-1">
                {t("admin_dashboard.settings.use_mock_desc")}
              </p>
            </div>
            <Switch
              checked={isMock}
              onCheckedChange={(v) => {
                setSource(v ? "mock" : "real");
                toast.success(
                  v
                    ? t("admin_dashboard.settings.using_mock")
                    : "Using live database"
                );
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-kids-softPurple/40 dark:border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {t("admin_dashboard.settings.roles_explained")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="rounded-xl border-2 border-kids-softPurple/30 dark:border-primary/20 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Badge className="bg-magic border-0">{t("admin_dashboard.role.admin")}</Badge>
            </div>
            <p className="text-muted-foreground">
              {t("admin_dashboard.settings.admin_desc")}
            </p>
          </div>
          <div className="rounded-xl border-2 border-kids-softPurple/30 dark:border-primary/20 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary">{t("admin_dashboard.role.editor")}</Badge>
            </div>
            <p className="text-muted-foreground">
              {t("admin_dashboard.settings.editor_desc")}
            </p>
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card className="border-2 border-kids-softPurple/40 dark:border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-primary" />
              {i18n.language?.startsWith("ar") ? "مزايا التجربة (للأدمن فقط)" : "Trial features (admin only)"}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {i18n.language?.startsWith("ar")
                ? "تحكّم في المزايا المدفوعة المتاحة لك أثناء التجربة بدون التأثير على المستخدمين."
                : "Toggle paid features for your own admin testing without affecting users."}
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {trialToggles.map(({ key, icon: Icon, labelAr, labelEn, descAr, descEn }) => {
              const isAr = i18n.language?.startsWith("ar");
              return (
                <div key={key} className="flex items-center justify-between rounded-xl border-2 border-kids-softPurple/30 dark:border-primary/20 p-4 bg-kids-softPurple/10 dark:bg-primary/5">
                  <div className="flex items-start gap-3">
                    <Icon className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <Label className="text-base font-bold">{isAr ? labelAr : labelEn}</Label>
                      <p className="text-xs text-muted-foreground mt-1">{isAr ? descAr : descEn}</p>
                    </div>
                  </div>
                  <Switch
                    checked={overrides[key]}
                    onCheckedChange={(v) => {
                      update({ [key]: v });
                      toast.success(isAr ? (v ? "تم التفعيل" : "تم التعطيل") : v ? "Enabled" : "Disabled");
                    }}
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {isAdmin && <SocialLinksManager />}
    </div>
  );
}
