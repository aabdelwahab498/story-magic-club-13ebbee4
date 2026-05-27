import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Trophy, Heart, Loader2, Home, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getLocalized, type Multilingual } from "@/lib/multilingual";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import WeeklyChallenge from "@/components/WeeklyChallenge";
import WinnerOfTheWeek from "@/components/WinnerOfTheWeek";
import HallOfFame from "@/components/HallOfFame";
import SubmissionInstructions from "@/components/SubmissionInstructions";

interface DBEntry {
  id: string;
  title: Multilingual;
  artist: Multilingual;
  image: string | null;
  votes: number;
}

const DrawingCompetition = () => {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const { user } = useAuth();
  const [entries, setEntries] = useState<DBEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [myVotes, setMyVotes] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("drawing_entries")
      .select("id,title,artist,image,votes")
      .eq("approved", true)
      .order("votes", { ascending: false });
    setEntries((data as unknown as DBEntry[]) || []);

    if (user) {
      const { data: votes } = await supabase
        .from("drawing_votes")
        .select("drawing_id")
        .eq("user_id", user.id);
      setMyVotes(new Set((votes || []).map((v) => v.drawing_id)));
    } else {
      setMyVotes(new Set());
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleVote = async (entryId: string) => {
    if (!user) {
      toast.error(t("drawing.vote_required_login"));
      return;
    }
    const has = myVotes.has(entryId);
    if (has) {
      const { error } = await supabase
        .from("drawing_votes")
        .delete()
        .eq("drawing_id", entryId)
        .eq("user_id", user.id);
      if (error) {
        toast.error(t("common.error"));
        return;
      }
      const next = new Set(myVotes);
      next.delete(entryId);
      setMyVotes(next);
      setEntries((arr) =>
        arr.map((e) => (e.id === entryId ? { ...e, votes: Math.max(e.votes - 1, 0) } : e))
      );
    } else {
      const { error } = await supabase
        .from("drawing_votes")
        .insert({ drawing_id: entryId, user_id: user.id });
      if (error) {
        toast.error(t("common.error"));
        return;
      }
      const next = new Set(myVotes);
      next.add(entryId);
      setMyVotes(next);
      setEntries((arr) =>
        arr.map((e) => (e.id === entryId ? { ...e, votes: e.votes + 1 } : e))
      );
    }
  };

  return (
    <div className="animate-fade-in" key={lang}>
      {/* Top navigation: Home + Explore Stories */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-4 sm:mb-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white/80 dark:bg-white/15 backdrop-blur-sm border border-foreground/10 dark:border-white/25 text-foreground dark:text-white font-bold text-sm shadow-sm hover:scale-105 hover:bg-white dark:hover:bg-white/25 transition-all"
        >
          <Home className="h-4 w-4" />
          {t("ai.back_to_home", "Back to Home")}
        </Link>
        <Link
          to="/stories"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary/90 hover:bg-primary text-primary-foreground font-bold text-sm shadow-sm hover:scale-105 transition-all"
        >
          <BookOpen className="h-4 w-4" />
          {t("ai.explore_stories", "Explore Stories")}
        </Link>
      </div>

      <div className="text-center mb-6 sm:mb-8 px-2">
        <h2 className="text-2xl sm:text-3xl font-bold text-kids-midnight">
          <Trophy className="inline-block me-2 text-kids-yellow h-6 w-6 sm:h-8 sm:w-8" />
          {t("drawing.title")}
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">{t("drawing.subtitle")}</p>
      </div>

      <WeeklyChallenge />

      <WinnerOfTheWeek />

      <HallOfFame />

      <SubmissionInstructions />

      <h3 className="text-lg sm:text-xl font-semibold mb-4 text-kids-midnight">
        {t("drawing.current_entries")}
      </h3>

      {loading ? (
        <div className="text-center py-10">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
        </div>
      ) : entries.length === 0 ? (
        <p className="text-center text-muted-foreground py-10">{t("drawing.empty")}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {entries.map((entry) => {
            const isVoted = myVotes.has(entry.id);
            return (
              <div
                key={entry.id}
                className="bg-card rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-all"
              >
                {entry.image && (
                  <div className="h-48 overflow-hidden">
                    <img
                      src={entry.image}
                      alt={getLocalized(entry.title, lang)}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="p-4">
                  <h4 className="font-bold text-kids-midnight">
                    {getLocalized(entry.title, lang)}
                  </h4>
                  <p className="text-muted-foreground text-sm">
                    {t("drawing.by")} {getLocalized(entry.artist, lang)}
                  </p>

                  <div className="flex justify-end items-center mt-4">
                    <button
                      onClick={() => handleVote(entry.id)}
                      className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm transition-colors ${
                        isVoted
                          ? "bg-kids-red text-white"
                          : "bg-muted hover:bg-kids-softPink"
                      }`}
                    >
                      <Heart className={`h-4 w-4 ${isVoted ? "fill-white" : ""}`} />
                      <span>{entry.votes}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DrawingCompetition;
