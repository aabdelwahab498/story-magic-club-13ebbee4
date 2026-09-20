-- 1) The story pipeline persists generated stories into public.stories with
-- request_id / pages / metadata, which the table did not have.
ALTER TABLE public.stories
  ADD COLUMN IF NOT EXISTS request_id uuid,
  ADD COLUMN IF NOT EXISTS pages jsonb,
  ADD COLUMN IF NOT EXISTS metadata jsonb;

CREATE INDEX IF NOT EXISTS stories_request_id_idx ON public.stories (request_id);

GRANT ALL ON public.stories TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.stories TO authenticated;

-- 2) Story generation deducts credits from public.user_credits, but no user
-- had a credits row, so every generation failed with 'Insufficient credits'.
-- Backfill a starter balance for all existing users and auto-provision new ones.
INSERT INTO public.user_credits (user_id, balance)
SELECT id, 20 FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

GRANT SELECT, INSERT, UPDATE ON public.user_credits TO service_role;
GRANT SELECT ON public.user_credits TO authenticated;

CREATE OR REPLACE FUNCTION public.provision_user_credits()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_credits (user_id, balance)
  VALUES (NEW.id, 20)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_credits ON auth.users;
CREATE TRIGGER on_auth_user_created_credits
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.provision_user_credits();