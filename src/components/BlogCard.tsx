import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Calendar, ArrowRight } from "lucide-react";
import { getLocalized } from "@/lib/multilingual";
import type { BlogPostRow } from "@/lib/contentApi";

interface BlogCardProps {
  post: BlogPostRow;
}

const categoryStyles: Record<string, string> = {
  updates: "bg-kids-softBlue text-kids-blue",
  achievements: "bg-kids-softYellow text-amber-700",
  collaborations: "bg-kids-softPurple text-primary",
};

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1200&q=70";

const BlogCard = ({ post }: BlogCardProps) => {
  const { t, i18n } = useTranslation();
  const date = post.published_at ?? post.created_at;
  const formatted = new Date(date).toLocaleDateString(i18n.language, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const cat = post.category_slug ?? "updates";
  const catClass = categoryStyles[cat] ?? categoryStyles.updates;

  return (
    <Link
      to={`/blog/${post.slug}`}
      className="group flex flex-col bg-white/95 dark:bg-card/90 rounded-3xl overflow-hidden shadow-soft border-2 border-white/60 hover:shadow-glow transition-all duration-300 hover-pop"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-muted">
        <img
          src={post.cover_image || FALLBACK_IMG}
          alt={getLocalized(post.title, i18n.language)}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <span
          className={`absolute top-3 start-3 px-3 py-1 rounded-full text-xs font-bold ${catClass}`}
        >
          {t(`blog.categories.${cat}`, { defaultValue: cat })}
        </span>
      </div>
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Calendar className="h-3.5 w-3.5" />
          <time dateTime={date}>{formatted}</time>
        </div>
        <h3 className="text-lg sm:text-xl font-bold text-kids-midnight dark:text-foreground mb-2 line-clamp-2">
          {getLocalized(post.title, i18n.language)}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-3 flex-1">
          {getLocalized(post.excerpt, i18n.language)}
        </p>
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary group-hover:gap-2 transition-all">
          {t("blog.read_more")}
          <ArrowRight className="h-4 w-4 rtl:rotate-180" />
        </span>
      </div>
    </Link>
  );
};

export default BlogCard;
