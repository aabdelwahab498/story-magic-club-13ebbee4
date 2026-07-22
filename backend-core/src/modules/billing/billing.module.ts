import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { billingProviderFactory } from './providers/billing.provider.factory.js';

@Module({
  controllers: [BillingController],
  providers: [
    BillingService,
    {
      provide: 'PAYMENT_PROVIDER',
      useFactory: billingProviderFactory,
    },
  ],
  exports: [BillingService],
})
export class BillingModule {}
