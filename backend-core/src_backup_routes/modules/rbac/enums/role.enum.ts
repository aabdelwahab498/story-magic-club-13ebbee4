/**
 * Application roles matching the Supabase `app_role` enum.
 *
 * The database defines five roles: admin, editor, user, super_admin, support.
 * This enum mirrors them exactly so the backend can reference roles
 * without string literals scattered across the codebase.
 */
export enum Role {
  ADMIN = 'admin',
  EDITOR = 'editor',
  USER = 'user',
  SUPER_ADMIN = 'super_admin',
  SUPPORT = 'support',
}
