import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, User as UserIcon, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Seo from "@/components/Seo";

const AccountProfile = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) toast.error(t("common.error", "Something went wrong"));
      setDisplayName(data?.display_name ?? "");
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, t]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const trimmed = displayName.trim();
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: trimmed || null })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error(t("profile.save_failed", "Could not save your profile"));
      return;
    }
    toast.success(t("profile.saved", "Profile updated"));
  };

  return (
    <div className="py-6 max-w-2xl mx-auto px-4">
      <Seo
        title="Profile — NajmaH"
        description="Manage your display name and how your stories are attributed."
      />
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground flex items-center gap-2">
          <UserIcon className="h-6 w-6 text-primary" />
          {t("profile.title", "Your Profile")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "profile.subtitle",
            "Your display name appears on stories you publish to the community.",
          )}
        </p>
      </header>

      <Card className="p-5 sm:p-6">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">{t("profile.email", "Email")}</Label>
              <Input id="email" value={user?.email ?? ""} disabled />
            </div>

            <div className="space-y-2">
              <Label htmlFor="display_name">
                {t("profile.display_name", "Display name")}
              </Label>
              <Input
                id="display_name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t(
                  "profile.display_name_placeholder",
                  "How should we credit you?",
                )}
                maxLength={60}
              />
              <p className="text-xs text-muted-foreground">
                {t(
                  "profile.display_name_help",
                  "Shown as “Written by …” on published community stories. Leave empty to use your account name.",
                )}
              </p>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={saving} className="gap-2">
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {t("common.save", "Save")}
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
};

export default AccountProfile;
