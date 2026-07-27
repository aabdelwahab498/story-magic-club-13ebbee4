/**
 * Granular permission keys used for fine-grained access control.
 *
 * These keys are stored in the `rbac_permissions` table and are checked
 * by the PermissionsGuard at the route level.
 *
 * Convention: `<domain>.<action>`
 */
export enum Permission {
  // Story domain
  STORY_CREATE = 'story.create',
  STORY_READ = 'story.read',
  STORY_UPDATE = 'story.update',
  STORY_DELETE = 'story.delete',

  // User management domain
  USER_MANAGE = 'user.manage',
  USER_READ = 'user.read',

  // Billing domain
  BILLING_MANAGE = 'billing.manage',
  BILLING_READ = 'billing.read',

  // AI domain
  AI_GENERATE = 'ai.generate',
  AI_CONFIGURE = 'ai.configure',

  // Admin domain
  ADMIN_DASHBOARD = 'admin.dashboard',
  ADMIN_SETTINGS = 'admin.settings',
}
