import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ADMIN_LANGUAGES } from "@/lib/adminConstants";
import { MOCK_STORIES, MOCK_VIDEOS } from "@/lib/adminMockData";

export default function AdminLanguagesPage() {
  const { t, i18n } = useTranslation();

  const totalItems = MOCK_STORIES.length + MOCK_VIDEOS.length;

  const stats = ADMIN_LANGUAGES.map((lang) => {
    const storyCount = MOCK_STORIES.filter((s) => !!s.title[lang.code]?.trim()).length;
    const videoCount = MOCK_VIDEOS.filter((v) => !!v.title[lang.code]?.trim()).length;
    const total = storyCount + videoCount;
    const coverage = totalItems > 0 ? Math.round((total / totalItems) * 100) : 0;
    return { ...lang, storyCount, videoCount, total, coverage };
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold">{t("admin_dashboard.languages.title")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("admin_dashboard.languages.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((s) => {
          const isCurrent = i18n.language === s.code;
          return (
            <Card
              key={s.code}
              className={`border-2 transition-all ${
                isCurrent ? "border-primary shadow-md" : ""
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <span className="text-2xl">{s.flag}</span>
                    <div>
                      <div>{s.label}</div>
                      <div className="text-xs font-normal text-muted-foreground" dir={s.rtl ? "rtl" : "ltr"}>
                        {s.nativeName}
                      </div>
                    </div>
                  </CardTitle>
                  {isCurrent && (
                    <Badge>{t("admin_dashboard.languages.current")}</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-muted-foreground">
                      {t("admin_dashboard.languages.coverage")}
                    </span>
                    <span className="font-medium">{s.coverage}%</span>
                  </div>
                  <Progress value={s.coverage} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md bg-muted/50 p-2">
                    <div className="text-xs text-muted-foreground">
                      {t("admin_dashboard.nav.stories")}
                    </div>
                    <div className="font-bold">
                      {s.storyCount} / {MOCK_STORIES.length}
                    </div>
                  </div>
                  <div className="rounded-md bg-muted/50 p-2">
                    <div className="text-xs text-muted-foreground">
                      {t("admin_dashboard.nav.videos")}
                    </div>
                    <div className="font-bold">
                      {s.videoCount} / {MOCK_VIDEOS.length}
                    </div>
                  </div>
                </div>
                {s.rtl && (
                  <Badge variant="outline" className="text-xs">
                    {t("admin_dashboard.languages.rtl")}
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
