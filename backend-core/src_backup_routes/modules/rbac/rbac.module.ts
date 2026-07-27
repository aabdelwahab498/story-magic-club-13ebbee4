import { Module } from '@nestjs/common';
import { SupabaseModule } from '../../supabase/supabase.module.js';
import { RbacService } from './rbac.service.js';

/**
 * RBAC module providing role and permission management.
 *
 * Exports RbacService so that guards and other modules can inject it.
 * Guards (RolesGuard, PermissionsGuard) are registered as APP_GUARDs
 * in AppModule to enforce the correct execution order:
 *   AuthGuard → RolesGuard → PermissionsGuard
 */
@Module({
  imports: [SupabaseModule],
  providers: [RbacService],
  exports: [RbacService],
})
export class RbacModule {}
