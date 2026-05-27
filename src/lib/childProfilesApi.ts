// Phase 2 — Child profiles (parent → many children).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ChildProfile {
  id: string;
  parent_user_id: string;
  name: string;
  age: number | null;
  avatar: string | null;
  preferred_language: string;
  emotional_focus: string[];
  bedtime_preferences: Record<string, unknown>;
  reading_level: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChildInput {
  name: string;
  age?: number | null;
  avatar?: string | null;
  preferred_language?: string;
  emotional_focus?: string[];
  reading_level?: string | null;
}

const ACTIVE_KEY = "najmah.active_child_id";

export const getActiveChildId = (): string | null =>
  typeof window !== "undefined" ? localStorage.getItem(ACTIVE_KEY) : null;

export const setActiveChildId = (id: string | null) => {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
};

export const useChildren = (enabled = true) =>
  useQuery({
    queryKey: ["child_profiles"],
    enabled,
    queryFn: async (): Promise<ChildProfile[]> => {
      const { data, error } = await supabase
        .from("child_profiles")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ChildProfile[];
    },
  });

export const useCreateChild = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ChildInput) => {
      const { data: sess } = await supabase.auth.getUser();
      const uid = sess.user?.id;
      if (!uid) throw new Error("not_signed_in");
      const { data, error } = await supabase
        .from("child_profiles")
        .insert([
          {
            parent_user_id: uid,
            name: input.name,
            age: input.age ?? null,
            avatar: input.avatar ?? null,
            preferred_language: input.preferred_language ?? "en",
            emotional_focus: (input.emotional_focus ?? []) as never,
            reading_level: input.reading_level ?? null,
          },
        ])
        .select("*")
        .single();
      if (error) throw error;
      return data as ChildProfile;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["child_profiles"] }),
  });
};

export const useUpdateChild = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<ChildInput>) => {
      const { error } = await supabase
        .from("child_profiles")
        .update({
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.age !== undefined ? { age: patch.age } : {}),
          ...(patch.avatar !== undefined ? { avatar: patch.avatar } : {}),
          ...(patch.preferred_language !== undefined
            ? { preferred_language: patch.preferred_language }
            : {}),
          ...(patch.emotional_focus !== undefined
            ? { emotional_focus: patch.emotional_focus as never }
            : {}),
          ...(patch.reading_level !== undefined
            ? { reading_level: patch.reading_level }
            : {}),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["child_profiles"] }),
  });
};

export const useDeleteChild = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("child_profiles").delete().eq("id", id);
      if (error) throw error;
      if (getActiveChildId() === id) setActiveChildId(null);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["child_profiles"] }),
  });
};

export const useActiveChild = () => {
  const { data: children = [], ...rest } = useChildren();
  const activeId = getActiveChildId();
  const active = children.find((c) => c.id === activeId) ?? children[0] ?? null;
  return { active, children, ...rest };
};
