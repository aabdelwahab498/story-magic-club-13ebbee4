
ALTER TABLE public.bedtime_schedules
  DROP CONSTRAINT IF EXISTS bedtime_schedules_unique_per_day;
ALTER TABLE public.bedtime_schedules
  ADD CONSTRAINT bedtime_schedules_unique_per_day
  UNIQUE (parent_user_id, child_profile_id, day_of_week);
