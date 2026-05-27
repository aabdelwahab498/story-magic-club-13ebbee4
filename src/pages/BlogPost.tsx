import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, Loader2 } from "lucide-react";
import { useBlogPost } from "@/lib/contentApi";
import { getLocalized } from "@/lib/multilingual";
import Seo from "@/components/Seo";
import NotFound from "./NotFound";

const FALLBACK_IMG =
  "https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=1600&q=70";

const BlogPost = () => {
  const { t, i18n } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const { data: post, isLoading } = useBlogPost(slug);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!post) return <NotFound />;

  const date = post.published_at ?? post.created_at;
  const formatted = new Date(date).toLocaleDateString(i18n.language, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const cat = post.category_slug ?? "updates";

  const title = getLocalized(post.title, i18n.language);
  const excerpt = getLocalized(post.excerpt, i18n.language);

  return (
    <article className="py-4 sm:py-6 max-w-3xl mx-auto">
      <Seo
        title={`${title} — NajmaH Blog`}
        description={excerpt}
        path={`/blog/${post.slug}`}
        image={post.cover_image ?? undefined}
        type="article"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: title,
          description: excerpt,
          image: post.cover_image ?? undefined,
          datePublished: post.published_at ?? post.created_at,
          author: post.author_name ? { "@type": "Person", name: post.author_name } : undefined,
        }}
      />
      <Link
        to="/blog"
        className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:gap-3 transition-all mb-4"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        {t("blog.back_to_list")}
      </Link>

      <header className="mb-6">
        <span className="inline-block px-3 py-1 rounded-full bg-kids-softPurple text-primary text-xs font-bold mb-3">
          {t(`blog.categories.${cat}`, { defaultValue: cat })}
        </span>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground mb-3 leading-tight">
          {getLocalized(post.title, i18n.language)}
        </h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="h-4 w-4" />
          <time dateTime={date}>{formatted}</time>
        </div>
      </header>

      <div className="rounded-3xl overflow-hidden shadow-soft border-2 border-white/60 mb-6">
        <img
          src={post.cover_image || FALLBACK_IMG}
          alt={getLocalized(post.title, i18n.language)}
          className="w-full aspect-[16/9] object-cover"
        />
      </div>

      <div className="bg-white/95 dark:bg-card/90 rounded-3xl p-6 sm:p-8 shadow-soft border-2 border-white/60">
        <p className="text-lg text-muted-foreground italic mb-4">
          {getLocalized(post.excerpt, i18n.language)}
        </p>
        <div className="text-base sm:text-lg leading-relaxed text-foreground whitespace-pre-line">
          {getLocalized(post.content, i18n.language)}
        </div>
      </div>
    </article>
  );
};

export default BlogPost;
