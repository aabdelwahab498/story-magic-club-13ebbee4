import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Smartphone, Share, Plus, Check } from "lucide-react";
import { usePwaInstall } from "@/hooks/usePwaInstall";
import Seo from "@/components/Seo";
import { toast } from "sonner";

const Install = () => {
  const { t } = useTranslation();
  const { canInstall, isInstalled, isIOS, isAndroid, promptInstall } = usePwaInstall();

  const onInstall = async () => {
    const outcome = await promptInstall();
    if (outcome === "accepted") toast.success(t("pwa.installed_toast", "App installed!"));
  };

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      <Seo
        title={t("pwa.page_title", "Install NajmaH on your device")}
        description={t(
          "pwa.page_desc",
          "Install NajmaH as an app on your phone or tablet for the best experience — fast launch, full-screen, and easy access from your home screen.",
        )}
        path="/install"
      />

      <div className="text-center space-y-3">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-magic shadow-glow">
          <Smartphone className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="text-3xl font-bold">
          {t("pwa.page_title", "Install NajmaH on your device")}
        </h1>
        <p className="text-muted-foreground">
          {t("pwa.page_desc", "Install NajmaH as an app on your phone or tablet for the best experience — fast launch, full-screen, and easy access from your home screen.")}
        </p>
      </div>

      {isInstalled && (
        <Card className="border-2 border-green-500/40 bg-green-500/10">
          <CardContent className="p-6 flex items-center gap-3">
            <Check className="h-6 w-6 text-green-600" />
            <p className="font-semibold">{t("pwa.already_installed", "NajmaH is already installed on this device. 🎉")}</p>
          </CardContent>
        </Card>
      )}

      {!isInstalled && canInstall && (
        <Card>
          <CardContent className="p-6 flex flex-col sm:flex-row items-center gap-4 justify-between">
            <p className="text-lg font-semibold">{t("pwa.one_click", "One-click install")}</p>
            <Button size="lg" onClick={onInstall} className="rounded-full bg-magic text-primary-foreground shadow-glow font-bold">
              <Download className="h-5 w-5 me-2" />
              {t("pwa.install", "Install app")}
            </Button>
          </CardContent>
        </Card>
      )}

      {!isInstalled && isIOS && (
        <Card>
          <CardHeader>
            <CardTitle>{t("pwa.ios_title", "Install on iPhone / iPad")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ol className="list-decimal ms-6 space-y-2">
              <li className="flex items-center gap-2">
                <Share className="h-4 w-4 text-primary" />
                <span>{t("pwa.ios_step1", "Tap the Share button in Safari (the square with an arrow).")}</span>
              </li>
              <li className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                <span>{t("pwa.ios_step2", "Scroll down and tap “Add to Home Screen”.")}</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>{t("pwa.ios_step3", "Tap “Add” in the top-right corner. NajmaH will appear on your home screen.")}</span>
              </li>
            </ol>
          </CardContent>
        </Card>
      )}

      {!isInstalled && !canInstall && !isIOS && (
        <Card>
          <CardHeader>
            <CardTitle>
              {isAndroid
                ? t("pwa.android_title", "Install on Android")
                : t("pwa.desktop_title", "Install on Desktop")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ol className="list-decimal ms-6 space-y-2">
              <li>{t("pwa.generic_step1", "Open your browser menu (⋮ or ⋯).")}</li>
              <li>{t("pwa.generic_step2", "Choose “Install app” or “Add to Home screen”.")}</li>
              <li>{t("pwa.generic_step3", "Confirm to add NajmaH to your device.")}</li>
            </ol>
            <p className="text-muted-foreground text-xs">
              {t("pwa.generic_note", "If you don't see the option, your browser may not support installable apps. Try Chrome, Edge, or Safari.")}
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="bg-accent/30 border-dashed">
        <CardContent className="p-6 space-y-2">
          <p className="font-bold">{t("pwa.benefits_title", "Why install?")}</p>
          <ul className="list-disc ms-6 space-y-1 text-sm text-muted-foreground">
            <li>{t("pwa.benefit_1", "Launches full-screen, like a native app.")}</li>
            <li>{t("pwa.benefit_2", "One-tap access from your home screen.")}</li>
            <li>{t("pwa.benefit_3", "Faster start and a cleaner reading experience for your child.")}</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

export default Install;
