import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { SupabaseModule } from '../supabase/supabase.module.js';
import { RbacModule } from '../modules/rbac/rbac.module.js';

@Module({
  imports: [SupabaseModule, RbacModule],
  controllers: [AuthController],
})
export class AuthModule {}
