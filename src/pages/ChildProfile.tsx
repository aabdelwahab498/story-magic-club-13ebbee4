import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Loader2, ArrowLeft, Star, User as UserIcon, BookOpen } from "lucide-react";
import { useChild } from "@/lib/childProfilesApi";
import { useChildStories } from "@/hooks/useStories";
import { getLocalized } from "@/lib/multilingual";

const ChildProfile = () => {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  
  const { data: child, isLoading: isChildLoading, isError: isChildError } = useChild(id);
  const { data: stories = [], isLoading: isStoriesLoading } = useChildStories(id);
  
  const currentLang = i18n.language?.startsWith("ar") ? "ar" : "en";

  if (isChildLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isChildError || !child) {
    return (
      <div className="max-w-md mx-auto text-center py-16 px-4">
        <h1 className="text-2xl font-extrabold mb-4">{t("family.child_not_found", "Child Profile Not Found")}</h1>
        <Link to="/family" className="text-primary hover:underline font-semibold flex items-center justify-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          {t("family.back", "Back to Family")}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 animate-fade-in">
      <Link
        to="/family"
        className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-primary transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        {t("family.back", "Back to Family")}
      </Link>

      <div className="bg-card rounded-3xl shadow-xl p-6 sm:p-10 mb-8 border border-border/50">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-kids-softPurple to-kids-softBlue flex items-center justify-center shrink-0 shadow-inner">
            <UserIcon className="h-12 w-12 sm:h-16 sm:w-16 text-primary opacity-80" />
          </div>
          <div className="flex-1 text-center sm:text-start">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-kids-midnight mb-2">
              {child.name}
            </h1>
            <p className="text-lg text-muted-foreground mb-4 font-medium">
              {child.age ? `${child.age} ${t("family.years_old", "years old")} • ` : ""}
              {child.language ? child.language.toUpperCase() : "EN"}
            </p>
            
            {child.emotionalGoals && child.emotionalGoals.length > 0 && (
              <div>
                <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  {t("family.interests", "Interests")}
                </p>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  {child.emotionalGoals.map((goal) => (
                    <span
                      key={goal}
                      className="px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20"
                    >
                      {t(`family.focus_options.${goal}`, goal)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mb-6 flex items-center gap-2">
        <Star className="h-6 w-6 text-yellow-400" />
        <h2 className="text-2xl font-extrabold text-kids-midnight">
          {t("family.generated_stories", "Generated Stories")}
        </h2>
      </div>

      {isStoriesLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : stories.length === 0 ? (
        <div className="bg-muted/30 rounded-2xl p-12 text-center border border-dashed border-border">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h3 className="text-xl font-bold mb-2 text-kids-midnight">
            {t("family.no_stories_yet", "No Stories Yet")}
          </h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-6">
            {t("family.no_stories_desc", "Generate a new story tailored to your child's interests and age.")}
          </p>
          <Link
            to="/ai-storyteller"
            className="inline-flex items-center justify-center px-6 py-3 rounded-full bg-primary text-white font-bold hover:opacity-90 transition-opacity"
          >
            {t("nav.ai_storyteller", "Create a Story")}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {stories.map((story) => {
            const title = getLocalized(story.title, currentLang);
            const desc = getLocalized(story.description, currentLang);
            return (
              <Link
                key={story.id}
                to={`/stories/${story.id}`}
                className="group relative flex flex-col bg-card rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all border border-border/50 hover:-translate-y-1"
              >
                <div className="aspect-[4/3] w-full bg-muted overflow-hidden relative">
                  {story.image ? (
                    <img
                      src={story.image}
                      alt={title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground p-6 text-center bg-gradient-to-br from-muted/50 to-muted">
                      <BookOpen className="h-10 w-10 mb-3 opacity-40" />
                      <span className="text-sm font-semibold opacity-60">
                        {t("stories.no_image", "A beautiful story awaits")}
                      </span>
                    </div>
                  )}
                  {story.age_range && (
                    <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-[10px] font-bold text-kids-midnight shadow-sm">
                      {story.age_range}
                    </div>
                  )}
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="font-extrabold text-lg line-clamp-1 mb-1 text-kids-midnight group-hover:text-primary transition-colors">
                    {title}
                  </h3>
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">
                    {desc}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ChildProfile;
