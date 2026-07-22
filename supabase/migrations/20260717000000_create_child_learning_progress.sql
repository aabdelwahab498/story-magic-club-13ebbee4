create table if not exists public.child_learning_progress (
  id uuid primary key default gen_random_uuid(),
  child_id uuid not null references public.child_profiles(id) on delete cascade,
  previous_level text not null,
  new_level text not null,
  reason text,
  created_at timestamp with time zone default now() not null
);

-- Enable RLS
alter table public.child_learning_progress enable row level security;

-- Policies
create policy "Users can view their children's learning progress"
  on public.child_learning_progress
  for select
  using (
    exists (
      select 1 from public.child_profiles
      where id = child_learning_progress.child_id
      and parent_user_id = auth.uid()
    )
    or public.has_role('admin')
    or public.has_role('editor')
  );

create policy "Users can insert their children's learning progress"
  on public.child_learning_progress
  for insert
  with check (
    exists (
      select 1 from public.child_profiles
      where id = child_learning_progress.child_id
      and parent_user_id = auth.uid()
    )
    or public.has_role('admin')
  );

create policy "Users can update their children's learning progress"
  on public.child_learning_progress
  for update
  using (
    exists (
      select 1 from public.child_profiles
      where id = child_learning_progress.child_id
      and parent_user_id = auth.uid()
    )
    or public.has_role('admin')
  );

create policy "Users can delete their children's learning progress"
  on public.child_learning_progress
  for delete
  using (
    exists (
      select 1 from public.child_profiles
      where id = child_learning_progress.child_id
      and parent_user_id = auth.uid()
    )
    or public.has_role('admin')
  );

-- Indexes
create index if not exists child_learning_progress_child_id_idx on public.child_learning_progress(child_id);
