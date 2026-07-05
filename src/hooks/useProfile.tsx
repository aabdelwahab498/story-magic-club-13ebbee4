import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface UserProfile {
  display_name: string | null;
  avatar_url: string | null;
  preferred_language: string | null;
}

/**
 * Fetch the current user's profile row (display_name, avatar_url, etc.).
 * Returns null while loading or when the user is signed out.
 */
export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    supabase
      .from("profiles")
      .select("display_name, avatar_url, preferred_language")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setProfile(data ?? null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const refresh = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("profiles")
      .select("display_name, avatar_url, preferred_language")
      .eq("user_id", user.id)
      .maybeSingle();
    setProfile(data ?? null);
  };

  return { profile, loading, refresh };
}
