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
} from "@/lib/parentApi";
import { toast } from "sonner";

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
  const upsert = useUpsertSchedule();
  const del = useDeleteSchedule();

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
              label="Stories"
              value={stats?.totalStories ?? 0}
            />
            <StatCard
              icon={<Sparkles className="h-5 w-5" />}
              label="Avg quality"
              value={stats?.avgQuality ? `${stats.avgQuality}/25` : "—"}
            />
            <StatCard
              icon={<ShieldCheck className="h-5 w-5" />}
              label="Passed safety"
              value={stats?.passedCount ?? 0}
            />
            <StatCard
              icon={<Moon className="h-5 w-5" />}
              label="Bedtime rules"
              value={schedules.length}
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
                {stats.recentTitles.map((s) => (
                  <li key={s.id} className="py-2 flex items-center justify-between text-sm">
                    <span className="font-semibold text-foreground dark:text-white truncate pr-3">
                      {s.title ?? "Untitled"}
                    </span>
                    <span className="text-xs text-muted-foreground dark:text-white/60 font-bold whitespace-nowrap">
                      {s.quality_total ? `${s.quality_total}/25` : "—"} ·{" "}
                      {new Date(s.created_at).toLocaleDateString()}
                    </span>
                  </li>
                ))}
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
