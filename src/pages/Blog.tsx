import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { useBlogPosts } from "@/lib/contentApi";
import BlogCard from "@/components/BlogCard";
import { cn } from "@/lib/utils";

const categories = ["all", "updates", "achievements", "collaborations"] as const;

const Blog = () => {
  const { t } = useTranslation();
  const [active, setActive] = useState<(typeof categories)[number]>("all");
  const { data: posts, isLoading } = useBlogPosts();

  const filtered = useMemo(() => {
    const list = posts ?? [];
    return list.filter((p) => active === "all" || p.category_slug === active);
  }, [posts, active]);

  return (
    <div className="py-4 sm:py-6 lg:py-8">
      <header className="text-center mb-8 sm:mb-10 animate-fade-in">
        <span className="inline-block px-4 py-1.5 rounded-full bg-kids-softPurple text-primary text-sm font-bold mb-3">
          ⭐ {t("blog.eyebrow")}
        </span>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground mb-3">
          {t("blog.title")}
        </h1>
        <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
          {t("blog.subtitle")}
        </p>
      </header>

      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setActive(c)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-bold transition-all border-2",
              active === c
                ? "bg-primary text-primary-foreground border-primary shadow-soft"
                : "bg-white/80 dark:bg-card/60 text-foreground border-white/60 hover:bg-accent/40",
            )}
          >
            {c === "all" ? t("blog.all") : t(`blog.categories.${c}`)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">{t("blog.empty")}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 max-w-6xl mx-auto">
          {filtered.map((p) => (
            <BlogCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Blog;
