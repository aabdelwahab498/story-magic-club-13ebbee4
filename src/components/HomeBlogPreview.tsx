import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useBlogPosts } from "@/lib/contentApi";
import BlogCard from "./BlogCard";

const HomeBlogPreview = () => {
  const { t } = useTranslation();
  const { data: posts } = useBlogPosts();
  const latest = (posts ?? []).slice(0, 3);

  if (latest.length === 0) return null;

  return (
    <section className="my-10 sm:my-14">
      <div className="flex items-end justify-between mb-6 gap-3 flex-wrap">
        <div>
          <span className="inline-block px-3 py-1 rounded-full bg-kids-softPurple text-primary text-xs font-bold mb-2">
            ⭐ {t("blog.eyebrow")}
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground">
            {t("home.blog_section_title")}
          </h2>
        </div>
        <Link
          to="/blog"
          className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:gap-2 transition-all"
        >
          {t("home.see_all")}
          <ArrowRight className="h-4 w-4 rtl:rotate-180" />
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
        {latest.map((p) => (
          <BlogCard key={p.id} post={p} />
        ))}
      </div>
    </section>
  );
};

export default HomeBlogPreview;
