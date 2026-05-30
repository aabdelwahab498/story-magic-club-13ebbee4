
-- BYOK: encrypted user API keys
-- Add encrypted storage columns + display-safe metadata. The plaintext `api_key`
-- column is kept for backward-compat only and will no longer be read once
-- existing rows are migrated by the manage-user-api-key edge function on next save.

ALTER TABLE public.user_api_keys
  ADD COLUMN IF NOT EXISTS api_key_ciphertext text,
  ADD COLUMN IF NOT EXISTS api_key_iv text,
  ADD COLUMN IF NOT EXISTS key_last4 text,
  ADD COLUMN IF NOT EXISTS key_fingerprint text,
  ADD COLUMN IF NOT EXISTS encryption_version smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS last_validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS validation_status text;

-- Restrict the plaintext columns so clients can never SELECT them via the Data API.
-- Edge functions (service_role) keep full access; users see only safe metadata.
REVOKE SELECT (api_key, api_key_ciphertext, api_key_iv)
  ON public.user_api_keys FROM authenticated, anon;

-- Block clients from inserting/updating these columns directly; only the
-- edge function (running as service_role) is allowed to write secret material.
REVOKE INSERT (api_key, api_key_ciphertext, api_key_iv, key_last4, key_fingerprint, encryption_version)
  ON public.user_api_keys FROM authenticated, anon;
REVOKE UPDATE (api_key, api_key_ciphertext, api_key_iv, key_last4, key_fingerprint, encryption_version)
  ON public.user_api_keys FROM authenticated, anon;

-- Re-grant the safe, non-secret column set the UI needs.
GRANT SELECT (id, user_id, provider, label, base_url, text_model, image_model, capabilities,
              enabled, key_last4, key_fingerprint, last_validated_at, validation_status,
              encryption_version, created_at, updated_at)
  ON public.user_api_keys TO authenticated;
GRANT UPDATE (label, enabled, text_model, image_model, base_url, capabilities)
  ON public.user_api_keys TO authenticated;
GRANT ALL ON public.user_api_keys TO service_role;

-- Defense in depth: a trigger blocks any client-originated write that tries to
-- set or change secret columns. service_role bypasses RLS but still hits this
-- trigger; we allow it by checking the current role.
CREATE OR REPLACE FUNCTION public.guard_user_api_key_secrets()
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

  IF TG_OP = 'INSERT' THEN
    IF NEW.api_key IS NOT NULL
       OR NEW.api_key_ciphertext IS NOT NULL
       OR NEW.api_key_iv IS NOT NULL THEN
      RAISE EXCEPTION 'API key material must be written via the manage-user-api-key function';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.api_key IS DISTINCT FROM OLD.api_key
       OR NEW.api_key_ciphertext IS DISTINCT FROM OLD.api_key_ciphertext
       OR NEW.api_key_iv IS DISTINCT FROM OLD.api_key_iv
       OR NEW.key_last4 IS DISTINCT FROM OLD.key_last4
       OR NEW.key_fingerprint IS DISTINCT FROM OLD.key_fingerprint THEN
      RAISE EXCEPTION 'API key material must be rotated via the manage-user-api-key function';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_user_api_key_secrets ON public.user_api_keys;
CREATE TRIGGER guard_user_api_key_secrets
BEFORE INSERT OR UPDATE ON public.user_api_keys
FOR EACH ROW EXECUTE FUNCTION public.guard_user_api_key_secrets();
