create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  parent_user_id uuid not null,
  title text,
  theme text,
  sel_goal text,
  language text,
  reading_level text,
  status text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.story_requests (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  requested_by uuid not null,
  context_snapshot jsonb not null,
  status text not null,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

-- Enable RLS
alter table public.stories enable row level security;
alter table public.story_requests enable row level security;

-- Policies for stories
create policy "Users can view their children's stories"
  on public.stories for select
  using (
    parent_user_id = auth.uid()
    or public.has_role('admin')
    or public.has_role('editor')
  );

create policy "Users can insert their children's stories"
  on public.stories for insert
  with check (
    parent_user_id = auth.uid()
    or public.has_role('admin')
  );

create policy "Users can update their children's stories"
  on public.stories for update
  using (
    parent_user_id = auth.uid()
    or public.has_role('admin')
  );

create policy "Users can delete their children's stories"
  on public.stories for delete
  using (
    parent_user_id = auth.uid()
    or public.has_role('admin')
  );

-- Policies for story_requests
create policy "Users can view their story requests"
  on public.story_requests for select
  using (
    requested_by = auth.uid()
    or public.has_role('admin')
  );

create policy "Users can insert story requests"
  on public.story_requests for insert
  with check (
    requested_by = auth.uid()
    or public.has_role('admin')
  );

create policy "Users can update their story requests"
  on public.story_requests for update
  using (
    requested_by = auth.uid()
    or public.has_role('admin')
  );

-- Indexes
create index if not exists stories_child_id_idx on public.stories(child_id);
create index if not exists stories_parent_user_id_idx on public.stories(parent_user_id);
create index if not exists story_requests_child_id_idx on public.story_requests(child_id);
create index if not exists story_requests_requested_by_idx on public.story_requests(requested_by);
