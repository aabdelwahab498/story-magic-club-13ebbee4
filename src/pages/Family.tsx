// Phase 2 — Family page: parent manages multiple child profiles.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Loader2, Plus, Trash2, User as UserIcon, Star, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import {
  useChildren,
  useCreateChild,
  useDeleteChild,
  useUpdateChild,
  setActiveChildId,
  getActiveChildId,
} from "@/lib/childProfilesApi";
import { useAuth } from "@/hooks/useAuth";

const LANGS = ["en", "ar", "fr", "es", "de", "it"] as const;
const FOCUS_OPTIONS = [
  "anger", "jealousy", "shyness", "fear", "sadness", "rejection",
  "courage", "kindness", "patience", "confidence",
];

const Family = () => {
  const { t } = useTranslation();
  const { session, loading: authLoading } = useAuth();
  const { data: children = [], isLoading } = useChildren(!!session);
  const createMut = useCreateChild();
  const updateMut = useUpdateChild();
  const deleteMut = useDeleteChild();

  const [name, setName] = useState("");
  const [age, setAge] = useState<string>("");
  const [language, setLanguage] = useState<string>("en");
  const [focus, setFocus] = useState<string[]>([]);
  const [activeId, setActive] = useState<string | null>(getActiveChildId());

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-md mx-auto text-center py-16 px-4">
        <h1 className="text-2xl font-extrabold mb-2">
          {t("family.signin_required", "Sign in to manage your family")}
        </h1>
        <p className="text-muted-foreground mb-6">
          {t(
            "family.signin_hint",
            "Add up to 5 children, each with their own preferences and stories.",
          )}
        </p>
        <Button asChild>
          <Link to="/auth">{t("auth.sign_in_tab", "Sign in")}</Link>
        </Button>
      </div>
    );
  }

  const handleAdd = async () => {
    if (!name.trim()) return;
    try {
      const created = await createMut.mutateAsync({
        name: name.trim(),
        age: age ? Number(age) : null,
        preferred_language: language,
        emotional_focus: focus,
      });
      setName("");
      setAge("");
      setFocus([]);
      if (!activeId) {
        setActiveChildId(created.id);
        setActive(created.id);
      }
      toast.success(t("family.added", "Child added ✨"));
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleSelect = (id: string) => {
    setActiveChildId(id);
    setActive(id);
    toast.success(t("family.selected", "Active child set"));
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("family.confirm_delete", "Remove this child profile?"))) return;
    await deleteMut.mutateAsync(id);
    if (activeId === id) setActive(null);
  };

  const toggleFocus = (f: string) =>
    setFocus((cur) => (cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f]));

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-2">
          <Star className="h-7 w-7 text-yellow-400" />
          {t("family.title", "My Family")}
        </h1>
        <Button asChild variant="outline" size="sm">
          <Link to="/">
            <Home className="h-4 w-4 mr-1" /> {t("ai.back_to_home", "Home")}
          </Link>
        </Button>
      </div>

      {/* Add new child */}
      <Card className="p-4 sm:p-6 mb-6">
        <h2 className="font-bold mb-3 flex items-center gap-2">
          <Plus className="h-4 w-4" /> {t("family.add_child", "Add a child")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label>{t("family.name", "Name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>{t("family.age", "Age")}</Label>
            <Input
              type="number"
              min={2}
              max={14}
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
          </div>
          <div>
            <Label>{t("family.language", "Language")}</Label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {LANGS.map((l) => (
                <option key={l} value={l}>
                  {l.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3">
          <Label className="block mb-2">
            {t("family.focus", "Emotional focus (optional)")}
          </Label>
          <div className="flex flex-wrap gap-2">
            {FOCUS_OPTIONS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => toggleFocus(f)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                  focus.includes(f)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-foreground border-border hover:bg-muted/70"
                }`}
              >
                {t(`family.focus_options.${f}`, f)}
              </button>
            ))}
          </div>
        </div>
        <Button
          className="mt-4"
          onClick={handleAdd}
          disabled={!name.trim() || createMut.isPending}
        >
          {createMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {t("family.add", "Add child")}
        </Button>
      </Card>

      {/* List */}
      <h2 className="font-bold mb-3">{t("family.children", "Your children")}</h2>
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : children.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          {t("family.empty", "No children yet. Add one above to get started.")}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {children.map((c) => {
            const isActive = c.id === activeId;
            return (
              <Card
                key={c.id}
                className={`p-4 flex items-center gap-3 transition-all ${
                  isActive ? "ring-2 ring-primary" : ""
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-kids-softPurple to-kids-softBlue flex items-center justify-center shrink-0">
                  <UserIcon className="h-6 w-6 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.age ? `${c.age} • ` : ""}
                    {c.preferred_language.toUpperCase()}
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <Button
                    size="sm"
                    variant={isActive ? "secondary" : "default"}
                    onClick={() => handleSelect(c.id)}
                    disabled={isActive}
                  >
                    {isActive ? t("family.active", "Active") : t("family.select", "Use")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(c.id)}
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Family;
