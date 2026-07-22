-- ============================================================================
-- Sprint 2.1 — RBAC Permission Key Alignment
-- ----------------------------------------------------------------------------
-- Aligns the Supabase `rbac_permissions` seed data with the backend
-- `Permission` enum (backend-core/src/modules/rbac/enums/permission.enum.ts),
-- which uses the dotted `<domain>.<action>` convention.
--
-- IMPORTANT: This migration is ADDITIVE and NON-DESTRUCTIVE.
--   * It does NOT modify or delete any existing migration.
--   * It does NOT remove the existing snake_case keys (e.g. `manage_stories`,
--     `view_audit_logs`) which the frontend sidebar and the `has_permission`
--     RLS RPC still rely on.
--   * It INSERTs the backend contract keys so that `@Permissions(...)` checks
--     in the NestJS backend resolve correctly for non-admin roles.
--     (admin / super_admin bypass permission checks in code, but are seeded
--      here for parity so the `has_permission` RPC is consistent.)
--
-- Backend Permission enum (source of truth):
--   story.create, story.read, story.update, story.delete
--   user.manage,  user.read
--   billing.manage, billing.read
--   ai.generate,  ai.configure
--   admin.dashboard, admin.settings
-- ============================================================================

INSERT INTO public.rbac_permissions (role, permission_key, granted) VALUES
  -- ── admin: full backend contract (also bypasses in code, seeded for parity)
  ('admin','story.create',   true),
  ('admin','story.read',     true),
  ('admin','story.update',   true),
  ('admin','story.delete',   true),
  ('admin','user.manage',    true),
  ('admin','user.read',      true),
  ('admin','billing.manage', true),
  ('admin','billing.read',   true),
  ('admin','ai.generate',    true),
  ('admin','ai.configure',   true),
  ('admin','admin.dashboard',true),
  ('admin','admin.settings', true),

  -- ── editor: content authoring + AI generation, read-only on users
  ('editor','story.create',  true),
  ('editor','story.read',    true),
  ('editor','story.update',  true),
  ('editor','story.delete',  true),
  ('editor','ai.generate',   true),
  ('editor','user.read',     true),

  -- ── support: read-only visibility for support workflows
  ('support','story.read',   true),
  ('support','user.read',    true),
  ('support','billing.read', true),

  -- ── user: baseline read access to stories
  ('user','story.read',      true)
ON CONFLICT (role, permission_key) DO NOTHING;
