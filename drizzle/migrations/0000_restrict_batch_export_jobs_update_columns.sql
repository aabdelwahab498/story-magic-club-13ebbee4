-- Restrict owner UPDATE on batch_export_jobs to the cancel_requested column only,
-- enforced at the privilege level (defense in depth alongside the guard trigger).

REVOKE UPDATE ON public.batch_export_jobs FROM authenticated;
GRANT UPDATE (cancel_requested) ON public.batch_export_jobs TO authenticated;

-- Keep service_role full access for backend workers.
GRANT ALL ON public.batch_export_jobs TO service_role;

DROP POLICY IF EXISTS "Owners can request cancel on batch jobs" ON public.batch_export_jobs;
CREATE POLICY "Owners can request cancel on batch jobs"
  ON public.batch_export_jobs FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Harden the guard trigger: deny any owner-side change other than cancel_requested,
-- including columns added later.
CREATE OR REPLACE FUNCTION public.guard_batch_export_jobs_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_json jsonb;
  new_json jsonb;
BEGIN
  IF current_setting('role', true) = 'service_role'
     OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  old_json := to_jsonb(OLD) - 'cancel_requested' - 'updated_at';
  new_json := to_jsonb(NEW) - 'cancel_requested' - 'updated_at';

  IF old_json IS DISTINCT FROM new_json THEN
    RAISE EXCEPTION 'Only cancel_requested can be modified by the owner';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_batch_export_jobs ON public.batch_export_jobs;
CREATE TRIGGER trg_guard_batch_export_jobs
  BEFORE UPDATE ON public.batch_export_jobs
  FOR EACH ROW EXECUTE FUNCTION public.guard_batch_export_jobs_update();