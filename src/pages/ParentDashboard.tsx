// Phase 5 — Parent Dashboard. Per-child SEL stats, recent stories,
// bedtime scheduling.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Trash2, Plus, Moon, Sparkles, ShieldCheck, BookOpen } from "lucide-react";
import { useChildren, setActiveChildId, getActiveChildId } from "@/lib/childProfilesApi";
import {
  useBedtimeSchedules,
  useUpsertSchedule,
  useDeleteSchedule,
  useChildStats,
  useFavoriteStories
} from "@/lib/parentApi";
import { toast } from "sonner";
import { storiesApi } from "@/api/stories.api";
import { useQueryClient } from "@tanstack/react-query";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const ParentDashboard = () => {
  const { data: kids = [], isLoading } = useChildren();
  const [activeId, setActiveId] = useState<string | null>(getActiveChildId());

  useEffect(() => {
    if (!activeId && kids[0]) setActiveId(kids[0].id);
  }, [kids, activeId]);

  const child = kids.find((c) => c.id === activeId) ?? null;
  const { data: stats } = useChildStats(activeId);
  const { data: schedules = [] } = useBedtimeSchedules(activeId);
  const { favorites, toggleFavorite, isFavorite } = useFavoriteStories();
  const upsert = useUpsertSchedule();
  const del = useDeleteSchedule();
  const qc = useQueryClient();

  const handleRetry = async (id: string) => {
    try {
      await storiesApi.retryStory(id);
      toast.success("Retrying story generation...");
      qc.invalidateQueries({ queryKey: ["child_stats"] });
    } catch {
      toast.error("Could not retry story");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await storiesApi.deleteStory(id);
      toast.success("Story deleted");
      qc.invalidateQueries({ queryKey: ["child_stats"] });
    } catch {
      toast.error("Could not delete story");
    }
  };

  const handlePickChild = (id: string) => {
    setActiveId(id);
    setActiveChildId(id);
  };

  const handleAddSchedule = async (day: number) => {
    if (!activeId) return;
    try {
      await upsert.mutateAsync({
        child_profile_id: activeId,
        day_of_week: day,
        start_time: "20:00",
        end_time: "07:00",
        dark_mode: true,
      });
      toast.success("Schedule saved");
    } catch (e) {
      console.error(e);
      toast.error("Could not save schedule");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!kids.length) {
    return (
      <div className="max-w-xl mx-auto text-center py-12 px-4">
        <h1 className="text-2xl font-extrabold text-foreground dark:text-white mb-3">
          Parent Dashboard
        </h1>
        <p className="text-muted-foreground dark:text-white/70 mb-6">
          Add a child profile to start tracking their reading journey.
        </p>
        <Link
          to="/family"
          className="inline-flex items-center gap-2 px-5 py-3 bg-primary text-primary-foreground rounded-full font-bold shadow"
        >
          <Plus className="h-4 w-4" /> Add Child
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground dark:text-white">
          Parent Dashboard
        </h1>
        <Link
          to="/family"
          className="text-sm font-bold text-primary inline-flex items-center gap-1 hover:underline"
        >
          <Plus className="h-4 w-4" /> Manage children
        </Link>
      </div>

      {/* Child picker */}
      <div className="flex flex-wrap gap-2 mb-6">
        {kids.map((k) => (
          <button
            key={k.id}
            onClick={() => handlePickChild(k.id)}
            className={`px-4 py-2 rounded-full font-bold text-sm border transition-all ${
              activeId === k.id
                ? "bg-primary text-primary-foreground border-primary shadow"
                : "bg-white dark:bg-white/10 text-foreground dark:text-white border-foreground/10 dark:border-white/20"
            }`}
          >
            {k.name} {k.age ? `· ${k.age}` : ""}
          </button>
        ))}
      </div>

      {child && (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard
              icon={<BookOpen className="h-5 w-5" />}
              label="Total"
              value={stats?.totalStories ?? 0}
            />
            <StatCard
              icon={<ShieldCheck className="h-5 w-5" />}
              label="Completed"
              value={stats?.completedCount ?? 0}
            />
            <StatCard
              icon={<Sparkles className="h-5 w-5" />}
              label="Generating"
              value={stats?.generatingCount ?? 0}
            />
            <StatCard
              icon={<Moon className="h-5 w-5" />}
              label="Failed"
              value={stats?.failedCount ?? 0}
            />
          </div>

          {/* EQ skill mix */}
          <Section title="EQ skills exercised">
            {stats && Object.keys(stats.skillCounts).length ? (
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.skillCounts).map(([k, v]) => (
                  <span
                    key={k}
                    className="px-3 py-1.5 rounded-full bg-primary/15 text-primary text-xs font-bold"
                  >
                    {k} · {v}
                  </span>
                ))}
              </div>
            ) : (
              <Empty>No SEL stories yet — generate one in the AI Storyteller.</Empty>
            )}
          </Section>

          {/* Recent stories */}
          <Section title="Recent stories">
            {stats?.recentTitles.length ? (
              <ul className="divide-y divide-foreground/10 dark:divide-white/10">
                {stats.recentTitles.map((s) => {
                  const statusMap: Record<string, { label: string, color: string }> = {
                    draft: { label: "Preparing", color: "text-muted-foreground" },
                    queued: { label: "Creating story", color: "text-amber-500 dark:text-amber-400" },
                    generating: { label: "Creating story", color: "text-amber-500 dark:text-amber-400" },
                    generated: { label: "Ready to read", color: "text-emerald-600 dark:text-emerald-400" },
                    failed: { label: "Needs retry", color: "text-red-500 dark:text-red-400" },
                  };
                  const mappedStatus = statusMap[s.status] || { label: s.status, color: "text-muted-foreground" };
                  const fav = isFavorite(s.id);
                  return (
                    <li key={s.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
                      <div className="flex flex-col gap-1 pr-3">
                        <span className="font-semibold text-foreground dark:text-white truncate">
                          {s.title}
                        </span>
                        <div className="flex items-center gap-2 text-xs font-bold">
                          <span className={mappedStatus.color}>{mappedStatus.label}</span>
                          <span className="text-muted-foreground dark:text-white/60">
                            · {new Date(s.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {s.status === 'generated' && (
                          <>
                            <Link to={`/my-stories/${s.id}`} className="px-3 py-1 bg-primary text-primary-foreground rounded-full text-xs font-bold">
                              View
                            </Link>
                            <button onClick={() => toggleFavorite(s.id)} className={`p-1.5 rounded-full border ${fav ? 'bg-rose-100 text-rose-500 border-rose-200' : 'bg-transparent text-muted-foreground border-border'}`}>
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill={fav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                            </button>
                          </>
                        )}
                        {s.status === 'failed' && (
                          <button onClick={() => handleRetry(s.id)} className="px-3 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 rounded-full text-xs font-bold">
                            Retry
                          </button>
                        )}
                        <button onClick={() => handleDelete(s.id)} className="p-1.5 text-muted-foreground hover:text-destructive rounded-full border border-border">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty>No stories yet.</Empty>
            )}
          </Section>

          {/* Bedtime schedule */}
          <Section title="Bedtime schedule (Dark Mode auto-engages)">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DAYS.map((d, i) => {
                const sched = schedules.find((s) => s.day_of_week === i);
                return (
                  <div
                    key={i}
                    className="rounded-xl border border-foreground/10 dark:border-white/15 bg-white/60 dark:bg-white/5 backdrop-blur-sm p-3"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-foreground dark:text-white">{d}</span>
                      {sched ? (
                        <button
                          onClick={() => del.mutate(sched.id)}
                          className="text-destructive hover:opacity-80"
                          aria-label="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAddSchedule(i)}
                          className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
                        >
                          <Plus className="h-3 w-3" /> Add
                        </button>
                      )}
                    </div>
                    {sched ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={sched.start_time.slice(0, 5)}
                          onChange={(e) =>
                            upsert.mutate({
                              child_profile_id: activeId!,
                              day_of_week: i,
                              start_time: e.target.value,
                              end_time: sched.end_time,
                              dark_mode: sched.dark_mode,
                            })
                          }
                          className="bg-background dark:bg-white/10 text-foreground dark:text-white rounded px-2 py-1 text-sm border border-foreground/10 dark:border-white/20"
                        />
                        <span className="text-muted-foreground dark:text-white/60">→</span>
                        <input
                          type="time"
                          value={sched.end_time.slice(0, 5)}
                          onChange={(e) =>
                            upsert.mutate({
                              child_profile_id: activeId!,
                              day_of_week: i,
                              start_time: sched.start_time,
                              end_time: e.target.value,
                              dark_mode: sched.dark_mode,
                            })
                          }
                          className="bg-background dark:bg-white/10 text-foreground dark:text-white rounded px-2 py-1 text-sm border border-foreground/10 dark:border-white/20"
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground dark:text-white/60">No rule</p>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>
        </>
      )}
    </div>
  );
};

const StatCard = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) => (
  <div className="rounded-xl border border-foreground/10 dark:border-white/15 bg-white/70 dark:bg-white/5 backdrop-blur-sm p-4">
    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground dark:text-white/70 mb-1">
      {icon}
      {label}
    </div>
    <div className="text-2xl font-extrabold text-foreground dark:text-white">{value}</div>
  </div>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-8">
    <h2 className="text-lg font-extrabold text-foreground dark:text-white mb-3">{title}</h2>
    <div className="rounded-2xl border border-foreground/10 dark:border-white/15 bg-white/70 dark:bg-white/5 backdrop-blur-sm p-4">
      {children}
    </div>
  </section>
);

const Empty = ({ children }: { children: React.ReactNode }) => (
  <p className="text-sm text-muted-foreground dark:text-white/60 font-semibold">{children}</p>
);

export default ParentDashboard;
