// Child profiles — backed directly by Lovable Cloud (`public.child_profiles`).
// Previously this module called a NestJS backend that is not deployed, which
// returned index.html and crashed the whole app (`children.find is not a function`).
import { supabase } from '@/integrations/supabase/client';

export interface ChildProfile {
  id: string;
  name: string;
  age: number;
  language: string;
  readingLevel?: string;
  emotionalGoals?: string[];
  avatar?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChildProfileDto {
  name: string;
  age: number;
  language: string;
  readingLevel?: string;
  emotionalGoals?: string[];
}

export interface UpdateChildProfileDto {
  name?: string;
  age?: number;
  language?: string;
  readingLevel?: string;
  emotionalGoals?: string[];
}

type Row = {
  id: string;
  name: string;
  age: number | null;
  avatar: string | null;
  preferred_language: string | null;
  emotional_focus: unknown;
  reading_level: string | null;
  created_at: string;
  updated_at: string;
};

const toGoals = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  return [];
};

const mapRow = (row: Row): ChildProfile => ({
  id: row.id,
  name: row.name,
  age: row.age ?? 0,
  language: row.preferred_language ?? 'en',
  readingLevel: row.reading_level ?? undefined,
  emotionalGoals: toGoals(row.emotional_focus),
  avatar: row.avatar,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const SELECT_COLS =
  'id,name,age,avatar,preferred_language,emotional_focus,reading_level,created_at,updated_at';

async function requireUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const id = data?.user?.id;
  if (!id) throw new Error('not_authenticated');
  return id;
}

export const childrenApi = {
  /** Returns [] for signed-out users instead of throwing, so headers never crash. */
  getChildren: async (): Promise<ChildProfile[]> => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth?.user) return [];
    const { data, error } = await supabase
      .from('child_profiles')
      .select(SELECT_COLS)
      .eq('parent_user_id', auth.user.id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return ((data ?? []) as unknown as Row[]).map(mapRow);
  },

  getChild: async (id: string): Promise<ChildProfile> => {
    const { data, error } = await supabase
      .from('child_profiles')
      .select(SELECT_COLS)
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('child_not_found');
    return mapRow(data as unknown as Row);
  },

  createChild: async (payload: CreateChildProfileDto): Promise<ChildProfile> => {
    const userId = await requireUserId();
    const { data, error } = await supabase
      .from('child_profiles')
      .insert({
        parent_user_id: userId,
        name: payload.name,
        age: payload.age ?? 0,
        preferred_language: payload.language ?? 'en',
        reading_level: payload.readingLevel ?? null,
        emotional_focus: payload.emotionalGoals ?? [],
      })
      .select(SELECT_COLS)
      .single();
    if (error) throw error;
    return mapRow(data as unknown as Row);
  },

  updateChild: async (id: string, payload: UpdateChildProfileDto): Promise<ChildProfile> => {
    const patch: Record<string, unknown> = {};
    if (payload.name !== undefined) patch.name = payload.name;
    if (payload.age !== undefined) patch.age = payload.age;
    if (payload.language !== undefined) patch.preferred_language = payload.language;
    if (payload.readingLevel !== undefined) patch.reading_level = payload.readingLevel;
    if (payload.emotionalGoals !== undefined) patch.emotional_focus = payload.emotionalGoals;

    const { data, error } = await supabase
      .from('child_profiles')
      .update(patch)
      .eq('id', id)
      .select(SELECT_COLS)
      .single();
    if (error) throw error;
    return mapRow(data as unknown as Row);
  },

  deleteChild: async (id: string): Promise<void> => {
    const { error } = await supabase.from('child_profiles').delete().eq('id', id);
    if (error) throw error;
  },
};
