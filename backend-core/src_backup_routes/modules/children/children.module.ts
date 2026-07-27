// src/modules/children/children.module.ts
import { Module } from '@nestjs/common';
import { ChildrenController } from './children.controller.js';
import { SupabaseModule } from '../../supabase/supabase.module.js';
import { RbacModule } from '../rbac/rbac.module.js';
import { ChildPreferencesService } from './preferences/preferences.service.js';
import { ChildrenAIContextService } from './ai-context/children-ai-context.service.js';
import { ChildrenService } from './children.service.js';

@Module({
  imports: [SupabaseModule, RbacModule],
  controllers: [ChildrenController],
  providers: [
    ChildrenService,
    ChildPreferencesService,
    ChildrenAIContextService,
  ],
  exports: [ChildrenService, ChildPreferencesService, ChildrenAIContextService],
})
export class ChildrenModule {}
