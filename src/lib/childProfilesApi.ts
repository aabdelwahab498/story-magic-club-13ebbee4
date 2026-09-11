// Phase 2 — Child profiles (parent → many children).
import { useSyncExternalStore } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { childrenApi, ChildProfile } from "@/api/children.api";

export type { ChildProfile };

export interface ChildInput {
  name: string;
  age?: number | null;
  language?: string;
  emotionalGoals?: string[];
  readingLevel?: string | null;
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
      const data = await childrenApi.getChildren();
      return (data ?? []) as ChildProfile[];
    },
  });

export const useChild = (id: string | undefined) =>
  useQuery({
    queryKey: ["child_profile", id],
    enabled: !!id,
    queryFn: async (): Promise<ChildProfile> => {
      if (!id) throw new Error("No child ID provided");
      const data = await childrenApi.getChild(id);
      return data as ChildProfile;
    },
  });

export const useCreateChild = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ChildInput) => {
      const data = await childrenApi.createChild({
        name: input.name,
        age: input.age ?? 0,
        language: input.language ?? 'en',
        readingLevel: input.readingLevel ?? undefined,
        emotionalGoals: input.emotionalGoals ?? [],
      });
      return data as ChildProfile;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["child_profiles"] }),
  });
};

export const useUpdateChild = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string } & Partial<ChildInput>) => {
      await childrenApi.updateChild(id, {
        name: patch.name,
        age: patch.age ?? undefined,
        language: patch.language ?? undefined,
        readingLevel: patch.readingLevel ?? undefined,
        emotionalGoals: patch.emotionalGoals ?? undefined,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["child_profiles"] }),
  });
};

export const useDeleteChild = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await childrenApi.deleteChild(id);
      if (getActiveChildId() === id) setActiveChildId(null);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["child_profiles"] }),
  });
};

export const useActiveChild = () => {
  const { data, ...rest } = useChildren();
  // Defensive: never assume the query returned an array — a broken API layer
  // used to return HTML here and crashed the whole app.
  const children: ChildProfile[] = Array.isArray(data) ? data : [];
  const activeId = getActiveChildId();
  const active = children.find((c) => c.id === activeId) ?? children[0] ?? null;
  return { active, children, ...rest };
};
