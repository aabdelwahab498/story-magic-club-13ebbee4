# Secrets Management Manual (secrets-management.md)

This manual outlines secret governance rules and audit procedures for hosting the Najmah AI Platform in production environments.

---

## 1. Zero-Commit Secret Policy
* **Disallowed commits:** Secrets must never be committed to git repositories. All configurations are injected dynamically at runtime via container engine environments.
* **Tracked file verification:** Check that no `.env` files are tracked by Git.
* **Scrubbing logs:** Both NestJS and FastAPI structured log output layers check and strip secret patterns (like `bearer`, `apikey`, or `key`) from error payloads and trace logs.

---

## 2. Supabase Service Role Key Isolation
* The `SUPABASE_SERVICE_ROLE_KEY` bypasses all Row-Level Security (RLS) rules.
* **Strict restriction:** This key must only be accessible within the container environment of the NestJS gateway. It must never be exposed or sent to frontend clients under any circumstances.

---

## 3. Master Encryption Key Rotation
* The `MASTER_ENCRYPTION_KEY` is a 64-character hexadecimal key used to encrypt sensitive user profiles or credentials.
* **Key rotation:** Standard compliance requires rotating this key annually. Rotate keys by applying database decryption routines with the old key, followed by encryption using the newly generated key.
