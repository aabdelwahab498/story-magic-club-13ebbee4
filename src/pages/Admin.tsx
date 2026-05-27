import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Plus, Trash2, Save, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SUPPORTED_LANGUAGES } from "@/i18n/config";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";

type Multi = Record<string, string>;

interface StoryRow {
  id: string;
  title: Multi;
  description: Multi;
  content: Multi;
  image: string | null;
  age_range: string | null;
  duration: string | null;
  published: boolean;
}

interface DrawingRow {
  id: string;
  title: Multi;
  artist: Multi;
  image: string | null;
  votes: number;
  approved: boolean;
}

const emptyMulti = (): Multi =>
  SUPPORTED_LANGUAGES.reduce((acc, l) => ({ ...acc, [l.code]: "" }), {} as Multi);

const Admin = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isAdmin, loading, refreshAdmin } = useAuth();

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [loading, user, navigate]);

  const becomeAdmin = async () => {
    if (!user) return;
    const { error } = await supabase
      .from("user_roles")
      .insert({ user_id: user.id, role: "admin" });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("admin.made_admin"));
    await refreshAdmin();
  };

  if (loading) {
    return (
      <div className="text-center py-16">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
      </div>
    );
  }

  if (!user) return null;

  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto bg-card rounded-2xl p-6 shadow text-center">
        <p className="text-muted-foreground mb-4">{t("admin.no_admin")}</p>
        <Button onClick={becomeAdmin}>{t("admin.make_me_admin")}</Button>
        <div className="mt-3">
          <Link to="/" className="text-sm text-primary hover:underline">
            ← {t("auth.back_home")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-kids-midnight">{t("admin.title")}</h2>
        <p className="text-muted-foreground">{t("admin.subtitle")}</p>
      </div>

      <Tabs defaultValue="stories">
        <TabsList>
          <TabsTrigger value="stories">{t("admin.tab_stories")}</TabsTrigger>
          <TabsTrigger value="drawings">{t("admin.tab_drawings")}</TabsTrigger>
        </TabsList>
        <TabsContent value="stories">
          <StoriesAdmin />
        </TabsContent>
        <TabsContent value="drawings">
          <DrawingsAdmin />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const StoriesAdmin = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState<StoryRow[]>([]);
  const [editing, setEditing] = useState<StoryRow | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("stories")
      .select("*")
      .order("created_at", { ascending: false });
    setItems((data as unknown as StoryRow[]) || []);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const startNew = () =>
    setEditing({
      id: "",
      title: emptyMulti(),
      description: emptyMulti(),
      content: emptyMulti(),
      image: "",
      age_range: "",
      duration: "",
      published: false,
    });

  const save = async () => {
    if (!editing) return;
    const payload = {
      title: editing.title,
      description: editing.description,
      content: editing.content,
      image: editing.image,
      age_range: editing.age_range,
      duration: editing.duration,
      published: editing.published,
    };
    if (editing.id) {
      const { error } = await supabase.from("stories").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("stories").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success(t("admin.saved"));
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("stories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("admin.deleted"));
    load();
  };

  return (
    <div className="mt-4">
      <div className="flex justify-end mb-4">
        <Button onClick={startNew} size="sm">
          <Plus className="h-4 w-4 me-1" />
          {t("admin.new_story")}
        </Button>
      </div>

      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((s) => (
            <div key={s.id} className="bg-card rounded-xl p-4 shadow flex gap-3">
              {s.image && (
                <img src={s.image} className="w-20 h-20 rounded object-cover" alt="" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{s.title.en || "(no title)"}</p>
                <p className="text-xs text-muted-foreground">
                  {s.published ? "✅" : "🔒"} · {s.age_range} · {s.duration}
                </p>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(s)}>
                    {t("admin.edit_story")}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => remove(s.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <StoryEditor
          story={editing}
          onChange={setEditing}
          onSave={save}
          onCancel={() => setEditing(null)}
        />
      )}
    </div>
  );
};

const StoryEditor = ({
  story,
  onChange,
  onSave,
  onCancel,
}: {
  story: StoryRow;
  onChange: (s: StoryRow) => void;
  onSave: () => void;
  onCancel: () => void;
}) => {
  const { t } = useTranslation();
  const [activeLang, setActiveLang] = useState<string>(SUPPORTED_LANGUAGES[0].code);
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold">
            {story.id ? t("admin.edit_story") : t("admin.new_story")}
          </h3>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div>
            <Label>{t("admin.image_url")}</Label>
            <Input
              value={story.image || ""}
              onChange={(e) => onChange({ ...story, image: e.target.value })}
            />
          </div>
          <div>
            <Label>{t("admin.age_range")}</Label>
            <Input
              value={story.age_range || ""}
              onChange={(e) => onChange({ ...story, age_range: e.target.value })}
            />
          </div>
          <div>
            <Label>{t("admin.duration")}</Label>
            <Input
              value={story.duration || ""}
              onChange={(e) => onChange({ ...story, duration: e.target.value })}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <Switch
            checked={story.published}
            onCheckedChange={(v) => onChange({ ...story, published: v })}
          />
          <Label>{t("admin.published")}</Label>
        </div>

        <Tabs value={activeLang} onValueChange={setActiveLang}>
          <TabsList className="flex flex-wrap h-auto">
            {SUPPORTED_LANGUAGES.map((l) => (
              <TabsTrigger key={l.code} value={l.code}>
                {l.flag} {l.code.toUpperCase()}
              </TabsTrigger>
            ))}
          </TabsList>
          {SUPPORTED_LANGUAGES.map((l) => (
            <TabsContent key={l.code} value={l.code} className="space-y-3 mt-4">
              <div>
                <Label>{t("admin.title_field")}</Label>
                <Input
                  dir={l.rtl ? "rtl" : "ltr"}
                  value={story.title[l.code] || ""}
                  onChange={(e) =>
                    onChange({ ...story, title: { ...story.title, [l.code]: e.target.value } })
                  }
                />
              </div>
              <div>
                <Label>{t("admin.description_field")}</Label>
                <Textarea
                  dir={l.rtl ? "rtl" : "ltr"}
                  value={story.description[l.code] || ""}
                  onChange={(e) =>
                    onChange({
                      ...story,
                      description: { ...story.description, [l.code]: e.target.value },
                    })
                  }
                />
              </div>
              <div>
                <Label>{t("admin.content_field")}</Label>
                <Textarea
                  dir={l.rtl ? "rtl" : "ltr"}
                  rows={6}
                  value={story.content[l.code] || ""}
                  onChange={(e) =>
                    onChange({
                      ...story,
                      content: { ...story.content, [l.code]: e.target.value },
                    })
                  }
                />
              </div>
              <div className="bg-muted/40 rounded-lg p-3 text-sm" dir={l.rtl ? "rtl" : "ltr"}>
                <p className="text-xs text-muted-foreground mb-1">{t("admin.preview")}:</p>
                <p className="font-bold">{story.title[l.code] || "—"}</p>
                <p className="text-muted-foreground">{story.description[l.code] || "—"}</p>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onCancel}>
            {t("admin.cancel")}
          </Button>
          <Button onClick={onSave}>
            <Save className="h-4 w-4 me-1" />
            {t("admin.save")}
          </Button>
        </div>
      </div>
    </div>
  );
};

const DrawingsAdmin = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState<DrawingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DrawingRow | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("drawing_entries")
      .select("*")
      .order("created_at", { ascending: false });
    setItems((data as unknown as DrawingRow[]) || []);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const startNew = () =>
    setEditing({
      id: "",
      title: emptyMulti(),
      artist: emptyMulti(),
      image: "",
      votes: 0,
      approved: false,
    });

  const save = async () => {
    if (!editing) return;
    const payload = {
      title: editing.title,
      artist: editing.artist,
      image: editing.image,
      approved: editing.approved,
    };
    if (editing.id) {
      const { error } = await supabase
        .from("drawing_entries")
        .update(payload)
        .eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("drawing_entries").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success(t("admin.saved"));
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("drawing_entries").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("admin.deleted"));
    load();
  };

  return (
    <div className="mt-4">
      <div className="flex justify-end mb-4">
        <Button size="sm" onClick={startNew}>
          <Plus className="h-4 w-4 me-1" /> {t("admin.new_story")}
        </Button>
      </div>
      {loading ? (
        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((d) => (
            <div key={d.id} className="bg-card rounded-xl p-4 shadow flex gap-3">
              {d.image && (
                <img src={d.image} className="w-20 h-20 rounded object-cover" alt="" />
              )}
              <div className="flex-1">
                <p className="font-bold truncate">{d.title.en || "(no title)"}</p>
                <p className="text-xs text-muted-foreground">
                  {d.approved ? "✅" : "🔒"} · {d.votes} votes
                </p>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(d)}>
                    {t("admin.edit_story")}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => remove(d.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">
                {editing.id ? t("admin.edit_story") : t("admin.new_story")}
              </h3>
              <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mb-4">
              <Label>{t("admin.image_url")}</Label>
              <Input
                value={editing.image || ""}
                onChange={(e) => setEditing({ ...editing, image: e.target.value })}
              />
            </div>

            <div className="flex items-center gap-2 mb-4">
              <Switch
                checked={editing.approved}
                onCheckedChange={(v) => setEditing({ ...editing, approved: v })}
              />
              <Label>{t("admin.approved")}</Label>
            </div>

            <Tabs defaultValue={SUPPORTED_LANGUAGES[0].code}>
              <TabsList className="flex flex-wrap h-auto">
                {SUPPORTED_LANGUAGES.map((l) => (
                  <TabsTrigger key={l.code} value={l.code}>
                    {l.flag} {l.code.toUpperCase()}
                  </TabsTrigger>
                ))}
              </TabsList>
              {SUPPORTED_LANGUAGES.map((l) => (
                <TabsContent key={l.code} value={l.code} className="space-y-3 mt-4">
                  <div>
                    <Label>{t("admin.title_field")}</Label>
                    <Input
                      dir={l.rtl ? "rtl" : "ltr"}
                      value={editing.title[l.code] || ""}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          title: { ...editing.title, [l.code]: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label>{t("admin.artist_field")}</Label>
                    <Input
                      dir={l.rtl ? "rtl" : "ltr"}
                      value={editing.artist[l.code] || ""}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          artist: { ...editing.artist, [l.code]: e.target.value },
                        })
                      }
                    />
                  </div>
                </TabsContent>
              ))}
            </Tabs>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setEditing(null)}>
                {t("admin.cancel")}
              </Button>
              <Button onClick={save}>
                <Save className="h-4 w-4 me-1" />
                {t("admin.save")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;
