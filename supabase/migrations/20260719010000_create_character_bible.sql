create table if not exists public.character_bibles (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  character_name text not null,
  role text,
  description text,
  age text,
  gender text,
  personality text,
  appearance jsonb not null default '{}'::jsonb,
  visual_traits jsonb not null default '{}'::jsonb,
  color_palette jsonb not null default '{}'::jsonb,
  clothing jsonb not null default '{}'::jsonb,
  expressions jsonb not null default '{}'::jsonb,
  reference_prompt text,
  version integer not null default 1,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Enable RLS
alter table public.character_bibles enable row level security;

-- Policies for character_bibles
create policy "Users can view their children's character bibles"
  on public.character_bibles for select
  using (
    exists (
      select 1 from public.stories s
      where s.id = character_bibles.story_id
      and (s.user_id = auth.uid() or s.parent_user_id = auth.uid())
    )
    or public.has_role('admin')
    or public.has_role('editor')
  );

create policy "Users can insert their children's character bibles"
  on public.character_bibles for insert
  with check (
    exists (
      select 1 from public.stories s
      where s.id = character_bibles.story_id
      and (s.user_id = auth.uid() or s.parent_user_id = auth.uid())
    )
    or public.has_role('admin')
  );

create policy "Users can update their children's character bibles"
  on public.character_bibles for update
  using (
    exists (
      select 1 from public.stories s
      where s.id = character_bibles.story_id
      and (s.user_id = auth.uid() or s.parent_user_id = auth.uid())
    )
    or public.has_role('admin')
  );

create policy "Users can delete their children's character bibles"
  on public.character_bibles for delete
  using (
    exists (
      select 1 from public.stories s
      where s.id = character_bibles.story_id
      and (s.user_id = auth.uid() or s.parent_user_id = auth.uid())
    )
    or public.has_role('admin')
  );

-- Indexes
create index if not exists character_bibles_story_id_idx on public.character_bibles(story_id);

-- Updated_at trigger
CREATE TRIGGER update_character_bibles_updated_at
    BEFORE UPDATE ON public.character_bibles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
