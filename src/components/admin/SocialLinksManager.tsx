import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Save, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  useSocialLinks,
  SOCIAL_PLATFORMS,
  SocialLinks,
} from "@/hooks/useSocialLinks";
import { PLATFORM_CONFIG } from "@/components/SocialIcons";

const PLACEHOLDERS: Record<string, string> = {
  facebook: "https://facebook.com/yourpage",
  instagram: "https://instagram.com/yourhandle",
  youtube: "https://youtube.com/@yourchannel",
  tiktok: "https://tiktok.com/@yourhandle",
  pinterest: "https://pinterest.com/yourhandle",
  reddit: "https://reddit.com/r/yoursub",
  amazon: "https://amazon.com/shops/yourstore",
};

const SocialLinksManager = () => {
  const { t } = useTranslation();
  const { links, save } = useSocialLinks();
  const [draft, setDraft] = useState<SocialLinks>(links);

  useEffect(() => {
    setDraft(links);
  }, [links]);

  const handleSave = () => {
    save(draft);
    toast.success(t("admin_dashboard.social.saved"));
  };

  return (
    <Card className="border-2 border-kids-softPurple/40 dark:border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ExternalLink className="h-5 w-5 text-primary" />
          {t("admin_dashboard.social.title")}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {t("admin_dashboard.social.subtitle")}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          {SOCIAL_PLATFORMS.map((platform) => {
            const cfg = PLATFORM_CONFIG[platform];
            const Icon = cfg.Icon;
            return (
              <div key={platform} className="space-y-1.5">
                <Label
                  htmlFor={`social-${platform}`}
                  className="flex items-center gap-2 text-sm font-bold"
                >
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-kids-softPurple/30 dark:bg-primary/20 text-foreground">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  {cfg.label}
                </Label>
                <Input
                  id={`social-${platform}`}
                  value={draft[platform]}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [platform]: e.target.value }))
                  }
                  placeholder={PLACEHOLDERS[platform]}
                  className="rounded-xl"
                  dir="ltr"
                />
              </div>
            );
          })}
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} className="rounded-full gap-2">
            <Save className="h-4 w-4" />
            {t("admin.save")}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {t("admin_dashboard.social.hint")}
        </p>
      </CardContent>
    </Card>
  );
};

export default SocialLinksManager;
