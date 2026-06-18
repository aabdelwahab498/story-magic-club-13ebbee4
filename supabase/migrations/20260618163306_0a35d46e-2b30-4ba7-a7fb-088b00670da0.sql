ALTER TABLE public.batch_export_jobs
  ADD COLUMN IF NOT EXISTS failed_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cancel_requested boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Owners can request cancel on batch jobs" ON public.batch_export_jobs;
CREATE POLICY "Owners can request cancel on batch jobs"
  ON public.batch_export_jobs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.guard_batch_export_jobs_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role'
     OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.child_id IS DISTINCT FROM OLD.child_id
     OR NEW.formats IS DISTINCT FROM OLD.formats
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.total IS DISTINCT FROM OLD.total
     OR NEW.completed IS DISTINCT FROM OLD.completed
     OR NEW.bundle_path IS DISTINCT FROM OLD.bundle_path
     OR NEW.bundle_url IS DISTINCT FROM OLD.bundle_url
     OR NEW.error IS DISTINCT FROM OLD.error
     OR NEW.failed_items::text IS DISTINCT FROM OLD.failed_items::text THEN
    RAISE EXCEPTION 'Only cancel_requested can be modified by the owner';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_batch_export_jobs ON public.batch_export_jobs;
CREATE TRIGGER trg_guard_batch_export_jobs
  BEFORE UPDATE ON public.batch_export_jobs
  FOR EACH ROW EXECUTE FUNCTION public.guard_batch_export_jobs_update();