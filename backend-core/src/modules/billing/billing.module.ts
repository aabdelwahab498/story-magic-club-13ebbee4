import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { PaddleProvider } from './providers/paddle.provider.js';
import { MockProvider } from './providers/mock.provider.js';
import { billingProviderFactory } from './providers/billing.provider.factory.js';
import { SupabaseModule } from '../../supabase/supabase.module.js';
import { RbacModule } from '../rbac/rbac.module.js';

@Module({
  imports: [SupabaseModule, RbacModule, ConfigModule],
  controllers: [BillingController],
  providers: [
    BillingService,
    PaddleProvider,
    MockProvider,
    {
      provide: 'PAYMENT_PROVIDER',
      inject: [ConfigService, PaddleProvider, MockProvider],
      useFactory: billingProviderFactory,
    },
  ],
  exports: [BillingService, PaddleProvider, MockProvider],
})
export class BillingModule {}
