import { Global, Module } from '@nestjs/common';
import { SupabaseModule } from '../../supabase/supabase.module.js';
import { RbacService } from './rbac.service.js';

/**
 * RBAC module providing role and permission management.
 * Marked @Global() so RbacService is available to global guards and controllers everywhere.
 */
@Global()
@Module({
  imports: [SupabaseModule],
  providers: [RbacService],
  exports: [RbacService],
})
export class RbacModule {}
