import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BookOpen, Image as ImageIcon, Volume2, WifiOff, RefreshCw, FileText } from "lucide-react";
import Seo from "@/components/Seo";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

type CachedItem = {
  url: string;
  cache: string;
  date?: string;
  contentType?: string;
};

type Group = {
  key: "stories" | "images" | "audio" | "other";
  label: string;
  icon: typeof BookOpen;
  items: CachedItem[];
};

function classify(item: CachedItem): Group["key"] {
  const url = item.url.toLowerCase();
  const ct = (item.contentType || "").toLowerCase();
  if (ct.startsWith("audio/") || /\.(mp3|wav|m4a|ogg|aac|opus)(\?|$)/.test(url)) return "audio";
  if (ct.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg|avif)(\?|$)/.test(url)) return "images";
  if (url.includes("/stories") || ct.includes("text/html") || ct.includes("application/json"))
    return "stories";
  return "other";
}

function fileNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop() || u.hostname;
    return decodeURIComponent(last);
  } catch {
    return url;
  }
}

export default function Offline() {
  const { t } = useTranslation();
  const online = useOnlineStatus();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [error, setError] = useState<string | null>(null);

  const scan = async () => {
    setLoading(true);
    setError(null);
    try {
      if (typeof caches === "undefined") {
        setError(t("offline_page.no_cache", "الكاش غير مدعوم في هذا المتصفح."));
        setGroups([]);
        return;
      }
      const names = await caches.keys();
      const collected: CachedItem[] = [];
      for (const name of names) {
        const cache = await caches.open(name);
        const reqs = await cache.keys();
        for (const req of reqs) {
          let date: string | undefined;
          let contentType: string | undefined;
          try {
            const res = await cache.match(req);
            if (res) {
              date = res.headers.get("date") || undefined;
              contentType = res.headers.get("content-type") || undefined;
            }
          } catch {
            /* ignore */
          }
          collected.push({ url: req.url, cache: name, date, contentType });
        }
      }
      const byKey: Record<Group["key"], CachedItem[]> = {
        stories: [], images: [], audio: [], other: [],
      };
      for (const item of collected) byKey[classify(item)].push(item);

      setGroups([
        { key: "stories", label: t("offline_page.stories", "القصص والصفحات"), icon: BookOpen, items: byKey.stories },
        { key: "images", label: t("offline_page.images", "الصور"), icon: ImageIcon, items: byKey.images },
        { key: "audio", label: t("offline_page.audio", "ملفات الصوت"), icon: Volume2, items: byKey.audio },
        { key: "other", label: t("offline_page.other", "ملفات أخرى"), icon: FileText, items: byKey.other },
      ]);
    } catch (e) {
      console.error(e);
      setError(t("offline_page.scan_error", "تعذّر قراءة الكاش."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { scan(); }, []);

  const totalCount = groups.reduce((s, g) => s + g.items.length, 0);
  const latestDate = groups
    .flatMap((g) => g.items.map((i) => i.date ? new Date(i.date).getTime() : 0))
    .reduce((a, b) => Math.max(a, b), 0);

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <Seo title={t("offline_page.seo_title", "وضع عدم الاتصال — NajmaH")} path="/offline" />

      <header className="bg-card rounded-2xl shadow-xl p-5 sm:p-6 mb-6">
        <div className="flex items-start gap-3">
          <div className={`p-3 rounded-full ${online ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-700"}`}>
            <WifiOff className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-extrabold text-kids-midnight mb-1">
              {t("offline_page.title", "وضع عدم الاتصال")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {online
                ? t("offline_page.online_note", "أنت متصل الآن. هذه القائمة تعرض ما تم حفظه محلياً للاستخدام بدون إنترنت.")
                : t("offline_page.offline_note", "لا يوجد اتصال. يمكنك فقط فتح القصص/الصور/الصوت الموجودة أدناه.")}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="px-3 py-1 rounded-full bg-muted font-bold">
                {totalCount} {t("offline_page.items_cached", "عنصر محفوظ")}
              </span>
              {latestDate > 0 && (
                <span className="px-3 py-1 rounded-full bg-muted">
                  {t("offline_page.last_updated", "آخر تحديث:")}{" "}
                  {new Date(latestDate).toLocaleString()}
                </span>
              )}
              <button
                onClick={scan}
                className="ms-auto inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-primary-foreground font-bold hover:opacity-90"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t("common.refresh", "تحديث")}
              </button>
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-xl p-4 mb-4 text-sm">{error}</div>
      )}

      {loading ? (
        <div className="text-center text-muted-foreground py-12">{t("common.loading", "Loading...")}</div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <section key={g.key} className="bg-card rounded-2xl shadow-md p-4 sm:p-5">
              <div className="flex items-center gap-2 mb-3">
                <g.icon className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-bold text-kids-midnight">{g.label}</h2>
                <span className="ms-auto text-xs font-bold px-2 py-0.5 rounded-full bg-muted">
                  {g.items.length}
                </span>
              </div>
              {g.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("offline_page.empty_group", "لا يوجد محتوى محفوظ في هذا القسم بعد.")}
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {g.items.slice(0, 50).map((it) => (
                    <li key={it.url + it.cache} className="py-2 flex items-center gap-3">
                      {g.key === "images" ? (
                        <img src={it.url} alt="" className="w-10 h-10 object-cover rounded" loading="lazy" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                          <g.icon className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <a
                          href={it.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block text-sm font-semibold truncate hover:underline"
                        >
                          {fileNameFromUrl(it.url)}
                        </a>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {it.date ? new Date(it.date).toLocaleString() : it.cache}
                        </p>
                      </div>
                    </li>
                  ))}
                  {g.items.length > 50 && (
                    <li className="pt-2 text-xs text-muted-foreground">
                      +{g.items.length - 50} {t("offline_page.more_items", "عنصر إضافي")}
                    </li>
                  )}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      <div className="mt-6 text-center">
        <Link to="/stories" className="text-primary font-semibold hover:underline">
          {t("offline_page.browse_library", "تصفّح مكتبة القصص")}
        </Link>
      </div>
    </div>
  );
}
