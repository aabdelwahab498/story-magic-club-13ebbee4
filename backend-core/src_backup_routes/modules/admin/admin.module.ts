import { Module } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { AdminController } from './admin.controller.js';
import { SupabaseModule } from '../../supabase/supabase.module.js';
import { RbacModule } from '../rbac/rbac.module.js';

@Module({
  imports: [SupabaseModule, RbacModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
